import type { LayerOption } from "../types";

type MapHeaderProps = {
  activeLayerId: string;
  layerOptions: LayerOption[];
  onLayerChange: (layerId: string) => void;
};

export default function MapHeader({
  activeLayerId,
  layerOptions,
  onLayerChange,
}: MapHeaderProps) {
  return (
    <header className="pointer-events-none absolute left-0 right-0 top-0 z-[500] px-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-lg bg-white/92 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Finnanäs
          </p>
          <h1 className="text-lg font-semibold leading-tight text-stone-950">
            Finnanäs map
          </h1>
        </div>

        <label className="pointer-events-auto rounded-lg bg-white/92 px-3 py-2 shadow-lg shadow-black/10 backdrop-blur">
          <span className="mb-1 block text-xs font-medium text-stone-500">Layer</span>
          <select
            value={activeLayerId}
            onChange={(event) => onLayerChange(event.target.value)}
            className="w-28 bg-transparent text-sm font-semibold text-stone-950 outline-none"
            aria-label="Choose map layer"
          >
            {layerOptions.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </header>
  );
}
