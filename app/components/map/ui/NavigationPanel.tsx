import { LocateFixed, X } from "lucide-react";
import type { RouteResult } from "../../../routing/findRoute";
import type { LocationStatus } from "../types";
import { formatDistance } from "../lib/featureUtils";

type NavigationPanelProps = {
  destinationName: string;
  isFollowingUser: boolean;
  locationError: string | null;
  locationStatus: LocationStatus;
  onExit: () => void;
  onRecenter: () => void;
  routeResult: RouteResult | null;
};

export default function NavigationPanel({
  destinationName,
  isFollowingUser,
  locationError,
  locationStatus,
  onExit,
  onRecenter,
  routeResult,
}: NavigationPanelProps) {
  const nextStep = routeResult?.steps[0] ?? null;

  return (
    <>
      <div className="absolute left-4 right-4 top-[max(1rem,env(safe-area-inset-top))] z-[620]">
        <div className="rounded-lg bg-stone-950 px-4 py-3 text-white shadow-lg shadow-black/20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Navigerar till
              </p>
              <h1 className="truncate text-xl font-semibold">{destinationName}</h1>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white"
              aria-label="Exit navigation"
              onClick={onExit}
            >
              <X aria-hidden="true" size={22} strokeWidth={2.5} />
            </button>
          </div>
          {routeResult ? (
            <p className="mt-2 text-sm text-stone-300">
              {formatDistance(routeResult.distanceMeters)} kvar
            </p>
          ) : null}
          {locationStatus === "error" ? (
            <p className="mt-2 text-sm text-amber-200">
              {locationError ?? "GPS kunde inte hämtas."}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className={`absolute right-4 top-[calc(max(1rem,env(safe-area-inset-top))+6.75rem)] z-[620] flex h-12 w-12 items-center justify-center rounded-lg shadow-lg shadow-black/10 backdrop-blur ${
          isFollowingUser
            ? "bg-blue-600 text-white"
            : "bg-white/95 text-stone-950"
        }`}
        aria-label="Recenter map"
        onClick={onRecenter}
      >
        <LocateFixed aria-hidden="true" size={23} strokeWidth={2.5} />
      </button>

      <section className="absolute inset-x-0 bottom-0 z-[620] rounded-t-[28px] bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 shadow-[0_-16px_48px_rgba(0,0,0,0.22)]">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            Nästa väg
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-stone-950">
            {nextStep ? nextStep.edgeId : "Väntar på rutt"}
          </h2>
          <p className="mt-2 text-sm text-stone-600">
            {nextStep
              ? `Följ ${nextStep.roadName} i ${formatDistance(nextStep.distanceMeters)}`
              : locationStatus === "loading"
                ? "Hämtar GPS..."
                : "Starta GPS eller gå närmare vägnätet."}
          </p>
        </div>
      </section>
    </>
  );
}
