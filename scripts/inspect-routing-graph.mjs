import fs from "node:fs";
import { buildRoutingGraph } from "../app/routing/routingGraph.ts";

const geoJsonPath = new URL("../public/finnasnas-map.geojson", import.meta.url);
const geoJson = JSON.parse(fs.readFileSync(geoJsonPath, "utf8"));
const graph = buildRoutingGraph(geoJson);

console.log(`nodes: ${graph.nodes.length}`);
console.log(`edges: ${graph.edges.length}`);
console.log(`split roads: ${graph.splitRoads.length}`);
console.log(`junctions: ${graph.junctions.length}`);
console.log("");

for (const road of graph.splitRoads) {
  console.log(
    `${road.roadName}: ${road.segments.length} internal segments, ${Math.round(
      road.totalDistanceMeters,
    )}m`,
  );
  for (const segment of road.segments) {
    console.log(
      `  - ${segment.id}: ${segment.from} -> ${segment.to}, ${segment.distanceMeters.toFixed(
        1,
      )}m`,
    );
  }
}

console.log("");

for (const junction of graph.junctions) {
  const roads = junction.roadNames.length ? junction.roadNames.join(", ") : "-";
  const markers = junction.markerNames.length ? junction.markerNames.join(", ") : "-";
  console.log(
    `${junction.nodeId} degree=${junction.degree} roads=[${roads}] markers=[${markers}]`,
  );
}
