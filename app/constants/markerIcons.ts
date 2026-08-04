import {
  CircleHelp,
  Road,
  Home,
  PiggyBank,
  Mountain,
  Warehouse,
  TreeDeciduous,
  TreePine,
  TentTree,
  type LucideIcon,
  Waypoints,
  WavesHorizontal,
  Trees,
  Sprout,
  Leaf,
  Skull,
  ChessKnight,
} from "lucide-react";

export const markerIconByName = {
  "Björkgläntan": TreeDeciduous,
  "Grangläntan": TreePine,
  "Grusgropen": Mountain,
  "Huset": Home,
  "Källan": WavesHorizontal,
  "Ladan": Warehouse,
  "Svinhuset": PiggyBank,
  "Tallgläntan": TentTree,
  "Unknown": CircleHelp,
  "Unknown 2": CircleHelp,
  "Unkown 3": CircleHelp,
  "Jarls bro": Road,
  "Ekgläntan": Trees,
  "Rönngläntan": Sprout,
  "Aspgläntan": Leaf,
  "Trollet": Skull, 
  "Paddocken": ChessKnight,
} as const satisfies Record<string, LucideIcon>;

export const fallbackMarkerIcon = CircleHelp;

export function getMarkerIcon(markerName: string) {
  if (markerName.startsWith("Junction:")) {
    return Waypoints;
  }

  return markerIconByName[markerName as keyof typeof markerIconByName] ?? fallbackMarkerIcon;
}
