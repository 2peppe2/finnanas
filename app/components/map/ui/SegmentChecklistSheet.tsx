import { X } from "lucide-react";
import type { RoutingEdge } from "../../../routing/routingGraph";
import { formatDistance } from "../lib/featureUtils";

type SegmentChecklistSheetProps = {
  highlightedSegmentIds: string[];
  isOpen: boolean;
  onClear: () => void;
  onClose: () => void;
  onToggleSegment: (segmentId: string) => void;
  segments: RoutingEdge[];
};

export default function SegmentChecklistSheet({
  highlightedSegmentIds,
  isOpen,
  onClear,
  onClose,
  onToggleSegment,
  segments,
}: SegmentChecklistSheetProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <section className="absolute inset-x-0 bottom-0 z-[650] max-h-[72svh] rounded-t-[24px] bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.24)]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
              Highlight
            </p>
            <h2 className="text-xl font-semibold text-stone-950">
              Road segments
            </h2>
          </div>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-stone-100 text-stone-950"
            aria-label="Close segment checklist"
            onClick={onClose}
          >
            <X aria-hidden="true" size={22} strokeWidth={2.5} />
          </button>
        </div>

        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg bg-stone-100 px-3 py-2">
          <p className="text-sm font-medium text-stone-700">
            {highlightedSegmentIds.length} selected
          </p>
          <button
            type="button"
            className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-950 shadow-sm"
            onClick={onClear}
          >
            Clear
          </button>
        </div>

        <div className="max-h-[52svh] overflow-y-auto pr-1">
          <ol className="space-y-2">
            {segments.map((segment) => {
              const isChecked = highlightedSegmentIds.includes(segment.id);

              return (
                <li key={segment.id}>
                  <label className="flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-3 shadow-sm">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => onToggleSegment(segment.id)}
                      className="h-5 w-5 accent-blue-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-stone-950">
                        {segment.id}
                      </span>
                      <span className="block text-xs text-stone-500">
                        {formatDistance(segment.distanceMeters)}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
