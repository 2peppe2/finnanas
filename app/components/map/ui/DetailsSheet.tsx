import type { RouteResult } from "../../../routing/findRoute";
import type { RoutingEdge } from "../../../routing/routingGraph";
import type { GeoJsonFeature, LocationStatus, UserLocation } from "../types";
import {
  formatDistance,
  formatPropertyValue,
  getFeatureColor,
} from "../lib/featureUtils";

type DetailsSheetProps = {
  connectedSegments: RoutingEdge[];
  guidanceText: string | null;
  locationError: string | null;
  locationStatus: LocationStatus;
  onClose: () => void;
  onNavigateToSelected: () => void;
  onPointerCancel: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerDown: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  onStartLocation: () => void;
  routeResult: RouteResult | null;
  selectedFeature: GeoJsonFeature | null;
  selectedName: string;
  showNavigateButton: boolean;
  sheetDragY: number;
  userLocation: UserLocation | null;
};

export default function DetailsSheet({
  connectedSegments,
  guidanceText,
  locationError,
  locationStatus,
  onClose,
  onNavigateToSelected,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onStartLocation,
  routeResult,
  selectedFeature,
  selectedName,
  showNavigateButton,
  sheetDragY,
  userLocation,
}: DetailsSheetProps) {
  const propertyEntries = Object.entries(selectedFeature?.properties ?? {});

  return (
    <section
      className={`absolute inset-x-0 bottom-0 z-[600] touch-pan-y rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-16px_48px_rgba(0,0,0,0.20)] ${
        sheetDragY > 0 ? "" : "transition-transform duration-300 ease-out"
      } ${selectedFeature ? "translate-y-0" : "translate-y-[calc(100%+2rem)]"}`}
      style={{
        transform: selectedFeature ? `translateY(${sheetDragY}px)` : undefined,
      }}
      aria-hidden={!selectedFeature}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <button
        type="button"
        className="mx-auto mb-3 block h-1.5 w-12 rounded-full bg-stone-300"
        aria-label="Close details"
        onClick={onClose}
      />

      {selectedFeature ? (
        <div className="mx-auto max-w-2xl">
          <div className="flex items-start gap-3">
            <span
              className="mt-1 h-4 w-4 shrink-0 rounded-full"
              style={{
                backgroundColor: getFeatureColor(selectedFeature),
              }}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Selected line
              </p>
              <h2 className="break-words text-2xl font-semibold text-stone-950">
                {selectedName}
              </h2>
            </div>
          </div>

          {showNavigateButton ? (
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white shadow-lg shadow-blue-950/20"
              onClick={onNavigateToSelected}
            >
              Ta mig hit
            </button>
          ) : null}

          <div className="mt-5 rounded-lg bg-stone-950 px-4 py-3 text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              Vägledning
            </p>
            {guidanceText ? (
              <>
                <p className="mt-1 text-xl font-semibold">{guidanceText}</p>
                <p className="mt-1 text-sm text-stone-300">
                  Noggrannhet: ca {formatDistance(userLocation?.accuracy ?? 0)}
                </p>
              </>
            ) : (
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-sm text-stone-300">
                  Slå på GPS för avstånd till den här linjen.
                </p>
                <button
                  type="button"
                  className="shrink-0 rounded-md bg-white px-3 py-2 text-sm font-semibold text-stone-950"
                  onClick={onStartLocation}
                >
                  Starta
                </button>
              </div>
            )}
            {locationStatus === "error" ? (
              <p className="mt-2 text-sm text-amber-200">
                {locationError ?? "GPS kunde inte hämtas."}
              </p>
            ) : null}
            {routeResult ? (
              <ol className="mt-3 space-y-1 border-t border-white/15 pt-3">
                {routeResult.steps.map((step) => (
                  <li
                    key={step.edgeId}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="truncate text-stone-100">{step.edgeId}</span>
                    <span className="shrink-0 text-stone-300">
                      {formatDistance(step.distanceMeters)}
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
            {connectedSegments.length > 0 ? (
              <div className="mt-3 border-t border-white/15 pt-3">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Connected segments
                </p>
                <ol className="mt-2 space-y-1">
                  {connectedSegments.map((segment) => (
                    <li
                      key={segment.id}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="truncate text-stone-100">{segment.id}</span>
                      <span className="shrink-0 text-stone-300">
                        {formatDistance(segment.distanceMeters)}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3">
            {propertyEntries.map(([key, value]) => (
              <div
                key={key}
                className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-stone-200 pt-3"
              >
                <dt className="text-sm font-medium capitalize text-stone-500">{key}</dt>
                <dd className="min-w-0 break-words text-sm font-semibold text-stone-950">
                  {formatPropertyValue(value)}
                </dd>
              </div>
            ))}
            <div className="grid grid-cols-[6.5rem_1fr] gap-3 border-t border-stone-200 pt-3">
              <dt className="text-sm font-medium text-stone-500">Geometry</dt>
              <dd className="text-sm font-semibold text-stone-950">
                {selectedFeature.geometry?.type ?? "Unknown"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}
    </section>
  );
}
