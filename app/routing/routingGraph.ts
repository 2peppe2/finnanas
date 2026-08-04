export type Coordinate = [number, number];

export type RoutingFeature = {
  type: "Feature";
  properties?: Record<string, unknown>;
  geometry?: {
    type: string;
    coordinates: unknown;
  };
};

export type RoutingGeoJson = {
  type: "FeatureCollection";
  features: RoutingFeature[];
};

export type RoutingNode = {
  id: string;
  coordinate: Coordinate;
  roadNames: string[];
  markerNames: string[];
};

export type RoutingEdge = {
  id: string;
  from: string;
  to: string;
  distanceMeters: number;
  difficulty: number;
  roadName: string;
  featureIndex: number;
  coordinates: Coordinate[];
  sourceSegmentIndexes: number[];
};

export type RoutingJunction = {
  nodeId: string;
  coordinate: Coordinate;
  roadNames: string[];
  markerNames: string[];
  degree: number;
};

export type RoutingGraph = {
  nodes: RoutingNode[];
  edges: RoutingEdge[];
  junctions: RoutingJunction[];
  splitRoads: SplitRoad[];
};

export type SplitRoadSegment = {
  id: string;
  from: string;
  to: string;
  coordinates: Coordinate[];
  distanceMeters: number;
  difficulty: number;
  roadName: string;
  featureIndex: number;
  sourceSegmentIndexes: number[];
};

export type SplitRoad = {
  featureIndex: number;
  roadName: string;
  originalCoordinates: Coordinate[];
  totalDistanceMeters: number;
  segments: SplitRoadSegment[];
};

type LineFeature = {
  feature: RoutingFeature;
  featureIndex: number;
  roadName: string;
  coordinates: Coordinate[];
};

type GraphNodeDraft = {
  coordinate: Coordinate;
  roadNames: Set<string>;
  markerNames: Set<string>;
};

const coordinatePrecision = 7;
const markerJunctionToleranceMeters = 5;
const roadMarkerToleranceMeters = 0.25;
const minimumSegmentLengthMeters = 2;

function isCoordinate(value: unknown): value is Coordinate {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  );
}

function isLineCoordinates(value: unknown): value is Coordinate[] {
  return Array.isArray(value) && value.every(isCoordinate);
}

function getFeatureName(feature: RoutingFeature, fallback: string) {
  const name = feature.properties?.name;
  return typeof name === "string" && name.trim() ? name : fallback;
}

function coordinateKey(coordinate: Coordinate) {
  return `${coordinate[0].toFixed(coordinatePrecision)},${coordinate[1].toFixed(
    coordinatePrecision,
  )}`;
}

function distanceMeters(a: Coordinate, b: Coordinate) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const deltaLat = toRadians(b[1] - a[1]);
  const deltaLng = toRadians(b[0] - a[0]);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
}

function metersProjector(origin: Coordinate) {
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng =
    111_320 * Math.cos((origin[1] * Math.PI) / 180);

  return (coordinate: Coordinate) => ({
    x: (coordinate[0] - origin[0]) * metersPerDegreeLng,
    y: (coordinate[1] - origin[1]) * metersPerDegreeLat,
  });
}

function projectedPointOnSegment(
  point: Coordinate,
  segmentStart: Coordinate,
  segmentEnd: Coordinate,
) {
  const project = metersProjector(point);
  const start = project(segmentStart);
  const end = project(segmentEnd);
  const segmentX = end.x - start.x;
  const segmentY = end.y - start.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return null;
  }

  const rawPosition =
    -(start.x * segmentX + start.y * segmentY) / segmentLengthSquared;
  const position = Math.max(0, Math.min(1, rawPosition));
  const closestX = start.x + segmentX * position;
  const closestY = start.y + segmentY * position;
  const distance = Math.hypot(closestX, closestY);

  return {
    distance,
    position,
    coordinate: [
      segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * position,
      segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * position,
    ] as Coordinate,
  };
}

function addNode(
  nodes: Map<string, GraphNodeDraft>,
  coordinate: Coordinate,
  roadName?: string,
  markerName?: string,
) {
  const key = coordinateKey(coordinate);
  const node = nodes.get(key) ?? {
    coordinate,
    markerNames: new Set<string>(),
    roadNames: new Set<string>(),
  };

  if (roadName) {
    node.roadNames.add(roadName);
  }

  if (markerName) {
    node.markerNames.add(markerName);
  }

  nodes.set(key, node);
  return key;
}

function insertSortedSplitPoint(
  splitPoints: Map<number, Coordinate[]>,
  segmentIndex: number,
  coordinate: Coordinate,
) {
  const segmentSplitPoints = splitPoints.get(segmentIndex) ?? [];

  if (!segmentSplitPoints.some((point) => coordinateKey(point) === coordinateKey(coordinate))) {
    segmentSplitPoints.push(coordinate);
  }

  splitPoints.set(segmentIndex, segmentSplitPoints);
}

function coordinateDistanceAlongSegment(
  coordinate: Coordinate,
  segmentStart: Coordinate,
  segmentEnd: Coordinate,
) {
  const project = metersProjector(segmentStart);
  const startPoint = project(segmentStart);
  const endPoint = project(segmentEnd);
  const point = project(coordinate);
  const segmentX = endPoint.x - startPoint.x;
  const segmentY = endPoint.y - startPoint.y;
  const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

  if (segmentLengthSquared === 0) {
    return 0;
  }

  return (
    ((point.x - startPoint.x) * segmentX + (point.y - startPoint.y) * segmentY) /
    segmentLengthSquared
  );
}

function routeDistanceMeters(coordinates: Coordinate[]) {
  return coordinates.reduce((sum, coordinate, index) => {
    if (index === 0) {
      return 0;
    }

    return sum + distanceMeters(coordinates[index - 1], coordinate);
  }, 0);
}

function appendCoordinate(coordinates: Coordinate[], coordinate: Coordinate) {
  if (
    coordinates.length === 0 ||
    coordinateKey(coordinates[coordinates.length - 1]) !== coordinateKey(coordinate)
  ) {
    coordinates.push(coordinate);
  }
}

function mergeCoordinates(
  firstCoordinates: Coordinate[],
  secondCoordinates: Coordinate[],
) {
  const coordinates = [...firstCoordinates];
  for (const coordinate of secondCoordinates) {
    appendCoordinate(coordinates, coordinate);
  }
  return coordinates;
}

function mergeSourceSegmentIndexes(firstIndexes: number[], secondIndexes: number[]) {
  return [...new Set([...firstIndexes, ...secondIndexes])].sort((a, b) => a - b);
}

function mergeAdjacentSegments(
  first: SplitRoadSegment,
  second: SplitRoadSegment,
): SplitRoadSegment | null {
  if (first.to !== second.from) {
    return null;
  }

  const coordinates = mergeCoordinates(first.coordinates, second.coordinates);

  return {
    ...first,
    coordinates,
    distanceMeters: routeDistanceMeters(coordinates),
    sourceSegmentIndexes: mergeSourceSegmentIndexes(
      first.sourceSegmentIndexes,
      second.sourceSegmentIndexes,
    ),
    to: second.to,
  };
}

function buildSplitRoadSegment(
  line: LineFeature,
  segmentIndex: number,
  from: string,
  to: string,
  coordinates: Coordinate[],
  sourceSegmentIndexes: number[],
): SplitRoadSegment {
  const id = `${line.roadName}-${segmentIndex + 1}`;

  return {
    coordinates,
    distanceMeters: routeDistanceMeters(coordinates),
    difficulty: 1,
    featureIndex: line.featureIndex,
    from,
    id,
    roadName: line.roadName,
    sourceSegmentIndexes,
    to,
  };
}

function normalizeSplitRoadSegments(
  line: LineFeature,
  segments: SplitRoadSegment[],
) {
  const normalizedSegments = segments.map((segment) => ({ ...segment }));
  let index = 0;

  while (index < normalizedSegments.length) {
    const segment = normalizedSegments[index];
    if (
      segment.distanceMeters >= minimumSegmentLengthMeters ||
      normalizedSegments.length === 1
    ) {
      index += 1;
      continue;
    }

    const previous =
      index > 0 ? normalizedSegments[index - 1] : null;
    const next =
      index < normalizedSegments.length - 1 ? normalizedSegments[index + 1] : null;
    const previousMerge = previous
      ? mergeAdjacentSegments(previous, segment)
      : null;
    const nextMerge = next ? mergeAdjacentSegments(segment, next) : null;
    const shouldMergePrevious =
      previousMerge &&
      (!nextMerge ||
        (previous !== null &&
          next !== null &&
          previous.distanceMeters <= next.distanceMeters));

    if (shouldMergePrevious) {
      normalizedSegments[index - 1] = previousMerge;
      normalizedSegments.splice(index, 1);
      index = Math.max(0, index - 1);
    } else if (nextMerge) {
      normalizedSegments[index + 1] = nextMerge;
      normalizedSegments.splice(index, 1);
    } else {
      index += 1;
    }
  }

  return normalizedSegments.map((segment, segmentIndex) =>
    buildSplitRoadSegment(
      line,
      segmentIndex,
      segment.from,
      segment.to,
      segment.coordinates,
      segment.sourceSegmentIndexes,
    ),
  );
}

function buildLineFeature(feature: RoutingFeature, featureIndex: number): LineFeature | null {
  if (
    feature.geometry?.type !== "LineString" ||
    !isLineCoordinates(feature.geometry.coordinates)
  ) {
    return null;
  }

  return {
    coordinates: feature.geometry.coordinates,
    feature,
    featureIndex,
    roadName: getFeatureName(feature, `Road ${featureIndex}`),
  };
}

export function buildRoutingGraph(geoJson: RoutingGeoJson): RoutingGraph {
  const lines = geoJson.features
    .map(buildLineFeature)
    .filter((line): line is LineFeature => Boolean(line));
  const pointMarkers = geoJson.features
    .filter(
      (feature) =>
        feature.geometry?.type === "Point" && isCoordinate(feature.geometry.coordinates),
    )
    .map((feature, index) => ({
      coordinate: feature.geometry?.coordinates as Coordinate,
      isJunction: feature.properties?.junction === true,
      markerName: getFeatureName(feature, `Marker ${index}`),
    }));
  const splitPointsByLine = new Map<LineFeature, Map<number, Coordinate[]>>();

  for (const line of lines) {
    const splitPoints = new Map<number, Coordinate[]>();
    insertSortedSplitPoint(splitPoints, 0, line.coordinates[0]);
    insertSortedSplitPoint(
      splitPoints,
      line.coordinates.length - 2,
      line.coordinates[line.coordinates.length - 1],
    );
    splitPointsByLine.set(line, splitPoints);
  }

  const candidatePoints = pointMarkers.filter((marker) => marker.isJunction);
  const canonicalNodeCoordinateBySplitKey = new Map<string, Coordinate>();

  const getNodeCoordinate = (coordinate: Coordinate) =>
    canonicalNodeCoordinateBySplitKey.get(coordinateKey(coordinate)) ?? coordinate;

  for (const line of lines) {
    const splitPoints = splitPointsByLine.get(line);
    if (!splitPoints) {
      continue;
    }

    for (let segmentIndex = 0; segmentIndex < line.coordinates.length - 1; segmentIndex += 1) {
      const start = line.coordinates[segmentIndex];
      const end = line.coordinates[segmentIndex + 1];

      for (const candidate of candidatePoints) {
        const projection = projectedPointOnSegment(candidate.coordinate, start, end);
        if (
          projection &&
          projection.position >= -0.0001 &&
          projection.position <= 1.0001 &&
          projection.distance <= markerJunctionToleranceMeters
        ) {
          const startDistance = distanceMeters(projection.coordinate, start);
          const endDistance = distanceMeters(projection.coordinate, end);
          const splitCoordinate =
            startDistance < minimumSegmentLengthMeters
              ? start
              : endDistance < minimumSegmentLengthMeters
                ? end
                : candidate.coordinate;

          canonicalNodeCoordinateBySplitKey.set(
            coordinateKey(splitCoordinate),
            candidate.coordinate,
          );

          insertSortedSplitPoint(
            splitPoints,
            segmentIndex,
            splitCoordinate,
          );
        }
      }
    }
  }

  for (const marker of pointMarkers.filter((pointMarker) => !pointMarker.isJunction)) {
    let nearest:
      | {
          line: LineFeature;
          segmentIndex: number;
          splitCoordinate: Coordinate;
          distance: number;
        }
      | null = null;

    for (const line of lines) {
      for (let segmentIndex = 0; segmentIndex < line.coordinates.length - 1; segmentIndex += 1) {
        const start = line.coordinates[segmentIndex];
        const end = line.coordinates[segmentIndex + 1];
        const projection = projectedPointOnSegment(marker.coordinate, start, end);

        if (!projection || projection.distance > roadMarkerToleranceMeters) {
          continue;
        }

        const startDistance = distanceMeters(projection.coordinate, start);
        const endDistance = distanceMeters(projection.coordinate, end);
        const splitCoordinate =
          startDistance < minimumSegmentLengthMeters
            ? start
            : endDistance < minimumSegmentLengthMeters
              ? end
              : marker.coordinate;

        if (!nearest || projection.distance < nearest.distance) {
          nearest = {
            distance: projection.distance,
            line,
            segmentIndex,
            splitCoordinate,
          };
        }
      }
    }

    if (!nearest) {
      continue;
    }

    const splitPoints = splitPointsByLine.get(nearest.line);
    if (!splitPoints) {
      continue;
    }

    canonicalNodeCoordinateBySplitKey.set(
      coordinateKey(nearest.splitCoordinate),
      marker.coordinate,
    );
    insertSortedSplitPoint(
      splitPoints,
      nearest.segmentIndex,
      nearest.splitCoordinate,
    );
  }

  const nodes = new Map<string, GraphNodeDraft>();
  const splitRoads: SplitRoad[] = [];

  for (const line of lines) {
    const splitPoints = splitPointsByLine.get(line);
    if (!splitPoints) {
      continue;
    }
    const splitRoadSegments: SplitRoadSegment[] = [];

    let pendingCoordinates: Coordinate[] = [];
    let pendingSourceSegmentIndexes: number[] = [];
    let pendingFrom: string | null = null;

    for (let segmentIndex = 0; segmentIndex < line.coordinates.length - 1; segmentIndex += 1) {
      const start = line.coordinates[segmentIndex];
      const end = line.coordinates[segmentIndex + 1];
      const breakpointKeys = new Set(
        (splitPoints.get(segmentIndex) ?? []).map(coordinateKey),
      );
      const orderedCoordinates = [
        start,
        ...(splitPoints.get(segmentIndex) ?? []),
        end,
      ].sort(
        (a, b) =>
          coordinateDistanceAlongSegment(a, start, end) -
          coordinateDistanceAlongSegment(b, start, end),
      )
        .filter(
          (coordinate, index, coordinates) =>
            index === 0 ||
            coordinateKey(coordinate) !== coordinateKey(coordinates[index - 1]),
        );

      for (const coordinate of orderedCoordinates) {
        const isBreakpoint = breakpointKeys.has(coordinateKey(coordinate));

        if (pendingFrom === null) {
          pendingCoordinates = [coordinate];
          if (isBreakpoint) {
            pendingFrom = addNode(nodes, getNodeCoordinate(coordinate), line.roadName);
          }
          continue;
        }

        appendCoordinate(pendingCoordinates, coordinate);
        if (!pendingSourceSegmentIndexes.includes(segmentIndex)) {
          pendingSourceSegmentIndexes.push(segmentIndex);
        }

        if (!isBreakpoint) {
          continue;
        }

        const nodeId = addNode(nodes, getNodeCoordinate(coordinate), line.roadName);
        if (nodeId === pendingFrom) {
          continue;
        }

        const segmentCoordinates = [...pendingCoordinates];
        splitRoadSegments.push(
          buildSplitRoadSegment(
            line,
            splitRoadSegments.length,
            pendingFrom,
            nodeId,
            segmentCoordinates,
            [...pendingSourceSegmentIndexes],
          ),
        );

        pendingFrom = nodeId;
        pendingCoordinates = [coordinate];
        pendingSourceSegmentIndexes = [];
      }
    }

    splitRoads.push({
      featureIndex: line.featureIndex,
      originalCoordinates: line.coordinates,
      roadName: line.roadName,
      totalDistanceMeters: splitRoadSegments.reduce(
        (sum, segment) => sum + segment.distanceMeters,
        0,
      ),
      segments: splitRoadSegments,
    });
  }

  for (const marker of pointMarkers) {
    addNode(nodes, marker.coordinate, undefined, marker.markerName);
  }

  for (const road of splitRoads) {
    road.segments = normalizeSplitRoadSegments(
      lines.find((line) => line.featureIndex === road.featureIndex) ?? {
        coordinates: road.originalCoordinates,
        feature: { type: "Feature" },
        featureIndex: road.featureIndex,
        roadName: road.roadName,
      },
      road.segments,
    );
    road.totalDistanceMeters = road.segments.reduce(
      (sum, segment) => sum + segment.distanceMeters,
      0,
    );
  }

  const degreeByNode = new Map<string, number>();
  const edges = splitRoads.flatMap((road) => road.segments);

  for (const edge of edges) {
    degreeByNode.set(edge.from, (degreeByNode.get(edge.from) ?? 0) + 1);
    degreeByNode.set(edge.to, (degreeByNode.get(edge.to) ?? 0) + 1);
  }

  const nodeList = [...nodes.entries()]
    .map(([id, node]) => ({
      coordinate: node.coordinate,
      id,
      markerNames: [...node.markerNames].sort(),
      roadNames: [...node.roadNames].sort(),
    }))
    .filter(
      (node) => node.markerNames.length > 0 || (degreeByNode.get(node.id) ?? 0) > 0,
    );

  const junctions = nodeList
    .map((node) => ({
      coordinate: node.coordinate,
      degree: degreeByNode.get(node.id) ?? 0,
      markerNames: node.markerNames,
      nodeId: node.id,
      roadNames: node.roadNames,
    }))
    .filter(
      (node) =>
        node.markerNames.length > 0 ||
        node.roadNames.length > 1 ||
        node.degree !== 2,
    );

  return {
    edges,
    junctions,
    nodes: nodeList,
    splitRoads,
  };
}
