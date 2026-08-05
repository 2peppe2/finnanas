import type {
  GeoJsonFeature,
  LineStringFeature,
  PointFeature,
  UserLocation,
} from "../types";

export function isLineStringFeature(
  feature: GeoJsonFeature | null,
): feature is LineStringFeature {
  return (
    feature?.geometry?.type === "LineString" &&
    Array.isArray(feature.geometry.coordinates)
  );
}

export function isPointFeature(feature: GeoJsonFeature | null): feature is PointFeature {
  return (
    feature?.geometry?.type === "Point" &&
    Array.isArray(feature.geometry.coordinates) &&
    feature.geometry.coordinates.length >= 2
  );
}

export function formatPropertyValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Not set";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

export function getFeatureName(feature: GeoJsonFeature | null) {
  return formatPropertyValue(feature?.properties?.name);
}

export function getFeatureColor(feature: GeoJsonFeature | null) {
  return String(
    feature?.properties?.stroke ??
      feature?.properties?.["marker-color"] ??
      "#ef4444",
  );
}

export function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  if (meters >= 100) {
    return `${Math.round(meters / 10) * 10} m`;
  }

  return `${Math.max(1, Math.round(meters / 5) * 5)} m`;
}

export function closestDistanceToFeature(
  location: UserLocation | null,
  feature: GeoJsonFeature | null,
) {
  if (!location || !isLineStringFeature(feature)) {
    return null;
  }

  const coordinates = feature.geometry.coordinates;
  if (coordinates.length === 0) {
    return null;
  }

  const originLat = location.lat;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos((originLat * Math.PI) / 180);
  const toPoint = ([lng, lat]: [number, number]) => ({
    x: (lng - location.lng) * metersPerDegreeLng,
    y: (lat - location.lat) * metersPerDegreeLat,
  });

  let shortestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = toPoint(coordinates[index]);
    const end = toPoint(coordinates[index + 1]);
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
    const rawPosition =
      segmentLengthSquared === 0
        ? 0
        : -(start.x * segmentX + start.y * segmentY) / segmentLengthSquared;
    const position = Math.max(0, Math.min(1, rawPosition));
    const closestX = start.x + segmentX * position;
    const closestY = start.y + segmentY * position;
    const distance = Math.hypot(closestX, closestY);

    shortestDistance = Math.min(shortestDistance, distance);
  }

  return shortestDistance;
}
