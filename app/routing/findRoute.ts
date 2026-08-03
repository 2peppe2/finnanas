import routingGraph from "./routing-graph.generated.json";
import type { Coordinate, RoutingEdge, RoutingGraph, RoutingNode } from "./routingGraph";

type RouteStep = {
  edgeId: string;
  roadName: string;
  distanceMeters: number;
};

export type RouteResult = {
  coordinates: Coordinate[];
  distanceMeters: number;
  segmentIds: string[];
  steps: RouteStep[];
};

type QueueItem = {
  nodeId: string;
  cost: number;
};

type AdjacencyStep = {
  edge: RoutingEdge;
  reversed: boolean;
  to: string;
};

const graph = routingGraph as RoutingGraph;
const temporaryStartNodeId = "__gps_start__";

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

function appendCoordinate(coordinates: Coordinate[], coordinate: Coordinate) {
  const last = coordinates[coordinates.length - 1];
  if (!last || last[0] !== coordinate[0] || last[1] !== coordinate[1]) {
    coordinates.push(coordinate);
  }
}

function appendCoordinates(coordinates: Coordinate[], nextCoordinates: Coordinate[]) {
  for (const coordinate of nextCoordinates) {
    appendCoordinate(coordinates, coordinate);
  }
}

function reverseCoordinates(coordinates: Coordinate[]) {
  return [...coordinates].reverse();
}

function routeDistanceMeters(coordinates: Coordinate[]) {
  return coordinates.reduce((sum, coordinate, index) => {
    if (index === 0) {
      return 0;
    }

    return sum + distanceMeters(coordinates[index - 1], coordinate);
  }, 0);
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

  return {
    coordinate: [
      segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * position,
      segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * position,
    ] as Coordinate,
    distanceMeters: Math.hypot(closestX, closestY),
    segmentIndex: 0,
  };
}

function buildAdjacency() {
  const adjacency = new Map<string, AdjacencyStep[]>();

  for (const edge of graph.edges) {
    adjacency.set(edge.from, [
      ...(adjacency.get(edge.from) ?? []),
      { edge, reversed: false, to: edge.to },
    ]);
    adjacency.set(edge.to, [
      ...(adjacency.get(edge.to) ?? []),
      { edge, reversed: true, to: edge.from },
    ]);
  }

  return adjacency;
}

const adjacency = buildAdjacency();

function createTemporaryEdge(
  id: string,
  from: string,
  to: string,
  edge: RoutingEdge,
  coordinates: Coordinate[],
): RoutingEdge {
  return {
    coordinates,
    difficulty: edge.difficulty,
    distanceMeters: routeDistanceMeters(coordinates),
    featureIndex: edge.featureIndex,
    from,
    id,
    roadName: edge.roadName,
    sourceSegmentIndexes: edge.sourceSegmentIndexes,
    to,
  };
}

function findNearestRouteAnchor(coordinate: Coordinate) {
  const nearestNode = findNearestRoutingNode(coordinate);
  let nearestEdge:
    | {
        distanceMeters: number;
        edge: RoutingEdge;
        projection: Coordinate;
        segmentIndex: number;
      }
    | null = null;

  for (const edge of graph.edges) {
    for (let index = 0; index < edge.coordinates.length - 1; index += 1) {
      const projection = projectedPointOnSegment(
        coordinate,
        edge.coordinates[index],
        edge.coordinates[index + 1],
      );

      if (!projection) {
        continue;
      }

      if (!nearestEdge || projection.distanceMeters < nearestEdge.distanceMeters) {
        nearestEdge = {
          distanceMeters: projection.distanceMeters,
          edge,
          projection: projection.coordinate,
          segmentIndex: index,
        };
      }
    }
  }

  if (!nearestEdge || (nearestNode && nearestNode.distanceMeters <= nearestEdge.distanceMeters)) {
    return {
      adjacency,
      nodeId: nearestNode?.node.id ?? null,
    };
  }

  const beforeCoordinates = [
    nearestEdge.projection,
    ...reverseCoordinates(nearestEdge.edge.coordinates.slice(0, nearestEdge.segmentIndex + 1)),
  ];
  const afterCoordinates = [
    nearestEdge.projection,
    ...nearestEdge.edge.coordinates.slice(nearestEdge.segmentIndex + 1),
  ];
  const temporaryAdjacency = new Map(adjacency);
  const toFromEdge = createTemporaryEdge(
    `${nearestEdge.edge.id}-gps-start-a`,
    temporaryStartNodeId,
    nearestEdge.edge.from,
    nearestEdge.edge,
    beforeCoordinates,
  );
  const toToEdge = createTemporaryEdge(
    `${nearestEdge.edge.id}-gps-start-b`,
    temporaryStartNodeId,
    nearestEdge.edge.to,
    nearestEdge.edge,
    afterCoordinates,
  );

  temporaryAdjacency.set(temporaryStartNodeId, [
    { edge: toFromEdge, reversed: false, to: nearestEdge.edge.from },
    { edge: toToEdge, reversed: false, to: nearestEdge.edge.to },
  ]);

  return {
    adjacency: temporaryAdjacency,
    nodeId: temporaryStartNodeId,
  };
}

export function findNearestRoutingNode(coordinate: Coordinate) {
  return graph.nodes.reduce<{ node: RoutingNode; distanceMeters: number } | null>(
    (nearest, node) => {
      const distance = distanceMeters(coordinate, node.coordinate);
      if (!nearest || distance < nearest.distanceMeters) {
        return { distanceMeters: distance, node };
      }

      return nearest;
    },
    null,
  );
}

export function findMarkerRoutingNode(markerName: string) {
  return (
    graph.nodes.find((node) => node.markerNames.includes(markerName)) ?? null
  );
}

export function findRouteBetweenNodes(
  fromNodeId: string,
  toNodeId: string,
  routeAdjacency = adjacency,
) {
  const costs = new Map<string, number>([[fromNodeId, 0]]);
  const previous = new Map<
    string,
    { edge: RoutingEdge; previousNodeId: string; reversed: boolean }
  >();
  const queue: QueueItem[] = [{ cost: 0, nodeId: fromNodeId }];
  const visited = new Set<string>();

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (!current || visited.has(current.nodeId)) {
      continue;
    }

    if (current.nodeId === toNodeId) {
      break;
    }

    visited.add(current.nodeId);

    for (const next of routeAdjacency.get(current.nodeId) ?? []) {
      const edgeCost = next.edge.distanceMeters * next.edge.difficulty;
      const nextCost = current.cost + edgeCost;
      const previousCost = costs.get(next.to);

      if (previousCost === undefined || nextCost < previousCost) {
        costs.set(next.to, nextCost);
        previous.set(next.to, {
          edge: next.edge,
          previousNodeId: current.nodeId,
          reversed: next.reversed,
        });
        queue.push({ cost: nextCost, nodeId: next.to });
      }
    }
  }

  if (!costs.has(toNodeId)) {
    return null;
  }

  const path: Array<{ edge: RoutingEdge; reversed: boolean }> = [];
  let cursor = toNodeId;

  while (cursor !== fromNodeId) {
    const step = previous.get(cursor);
    if (!step) {
      return null;
    }

    path.unshift({ edge: step.edge, reversed: step.reversed });
    cursor = step.previousNodeId;
  }

  const coordinates: Coordinate[] = [];
  const steps = path.map(({ edge, reversed }) => {
    appendCoordinates(
      coordinates,
      reversed ? reverseCoordinates(edge.coordinates) : edge.coordinates,
    );

    return {
      distanceMeters: edge.distanceMeters,
      edgeId: edge.id,
      roadName: edge.roadName,
    };
  });

  return {
    coordinates,
    distanceMeters: steps.reduce((sum, step) => sum + step.distanceMeters, 0),
    segmentIds: steps.map((step) => step.edgeId),
    steps,
  } satisfies RouteResult;
}

export function findRouteFromCoordinateToMarker(
  fromCoordinate: Coordinate,
  markerName: string,
) {
  const fromAnchor = findNearestRouteAnchor(fromCoordinate);
  const toNode = findMarkerRoutingNode(markerName);

  if (!fromAnchor.nodeId || !toNode) {
    return null;
  }

  return findRouteBetweenNodes(fromAnchor.nodeId, toNode.id, fromAnchor.adjacency);
}
