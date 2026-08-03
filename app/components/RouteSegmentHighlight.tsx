"use client";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import routingGraph from "../routing/routing-graph.generated.json";
import type { Coordinate, RoutingEdge } from "../routing/routingGraph";

type RouteSegmentHighlightProps = {
  map: L.Map | null;
  segmentIds: string[];
  coordinates?: Coordinate[];
};

function toLatLngs(coordinates: Coordinate[]) {
  return coordinates.map(([lng, lat]) => [lat, lng] as L.LatLngTuple);
}

export function getRoutingEdgeById(segmentId: string) {
  return (routingGraph.edges as RoutingEdge[]).find((edge) => edge.id === segmentId);
}

export function getRoutingEdgesByIds(segmentIds: string[]) {
  const segmentIdSet = new Set(segmentIds);
  return (routingGraph.edges as RoutingEdge[]).filter((edge) =>
    segmentIdSet.has(edge.id),
  );
}

export default function RouteSegmentHighlight({
  coordinates,
  map,
  segmentIds,
}: RouteSegmentHighlightProps) {
  const edges = useMemo(() => getRoutingEdgesByIds(segmentIds), [segmentIds]);
  const highlightLines = useMemo(
    () => (coordinates?.length ? [coordinates] : edges.map((edge) => edge.coordinates)),
    [coordinates, edges],
  );

  useEffect(() => {
    if (!map || highlightLines.length === 0) {
      return;
    }

    const halo = L.layerGroup(
      highlightLines.map((lineCoordinates) =>
        L.polyline(toLatLngs(lineCoordinates), {
          className: "route-segment-highlight-halo",
          color: "#ffffff",
          interactive: false,
          lineCap: "round",
          lineJoin: "round",
          opacity: 0.95,
          weight: 16,
        }),
      ),
    ).addTo(map);
    const lines = L.layerGroup(
      highlightLines.map((lineCoordinates) =>
        L.polyline(toLatLngs(lineCoordinates), {
          className: "route-segment-highlight",
          color: "#2563eb",
          interactive: false,
          lineCap: "round",
          lineJoin: "round",
          opacity: 0.95,
          weight: 7,
        }),
      ),
    ).addTo(map);

    return () => {
      halo.remove();
      lines.remove();
    };
  }, [highlightLines, map]);

  return null;
}
