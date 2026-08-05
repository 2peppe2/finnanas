import { Menu } from "lucide-react";
import type { LocationStatus } from "../types";

type MapActionButtonsProps = {
  isSegmentMenuOpen: boolean;
  locationStatus: LocationStatus;
  onOpenSegmentMenu: () => void;
  onStartLocation: () => void;
};

export default function MapActionButtons({
  isSegmentMenuOpen,
  locationStatus,
  onOpenSegmentMenu,
  onStartLocation,
}: MapActionButtonsProps) {
  return (
    <div className="absolute right-4 top-[calc(max(1rem,env(safe-area-inset-top))+5.25rem)] z-[500]">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          className="rounded-lg bg-white/95 px-3 py-2 text-sm font-semibold text-stone-950 shadow-lg shadow-black/10 backdrop-blur"
          onClick={onStartLocation}
        >
          {locationStatus === "loading" ? "Hämtar GPS" : "Min plats"}
        </button>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/95 text-stone-950 shadow-lg shadow-black/10 backdrop-blur"
          aria-label="Open segment checklist"
          aria-expanded={isSegmentMenuOpen}
          onClick={onOpenSegmentMenu}
        >
          <Menu aria-hidden="true" size={22} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
