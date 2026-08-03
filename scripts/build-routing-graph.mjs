import fs from "node:fs";
import { buildRoutingGraph } from "../app/routing/routingGraph.ts";

const geoJsonPath = new URL("../public/finnasnas-map.geojson", import.meta.url);
const outputPath = new URL(
  "../app/routing/routing-graph.generated.json",
  import.meta.url,
);
const geoJson = JSON.parse(fs.readFileSync(geoJsonPath, "utf8"));
const graph = buildRoutingGraph(geoJson);

fs.writeFileSync(outputPath, `${JSON.stringify(graph, null, 2)}\n`);

console.log(`Wrote ${outputPath.pathname}`);
console.log(`nodes: ${graph.nodes.length}`);
console.log(`edges: ${graph.edges.length}`);
console.log(`split roads: ${graph.splitRoads.length}`);
console.log(`junctions: ${graph.junctions.length}`);
