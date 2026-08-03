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
  WavesHorizontal,
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
} as const satisfies Record<string, LucideIcon>;

export const fallbackMarkerIcon = CircleHelp;
