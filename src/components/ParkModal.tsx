import { useAction, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { getCoasterTypeBadgeClasses } from "../lib/badges";
import { getErrorMessage } from "../lib/errors";
import { type CoasterSummary, getCoasterDisplayName } from "../lib/coasterData";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { ModalCloseButton, ModalContainer } from "./ModalContainer";
import { ScoreBadge } from "./ScoreBadge";

type ParkLineupResponse = {
  park: string;
  location: string;
  source: "coasterpedia" | "localFallback";
  sourceUrl?: string;
  coasters: CoasterSummary[];
};

export function ParkModal({
  park,
  initialLocation,
  initialSourceUrl,
  onClose,
  onSelectCoaster,
}: {
  park: string;
  initialLocation?: string;
  initialSourceUrl?: string;
  onClose: () => void;
  onSelectCoaster: (coaster: CoasterSummary) => void;
}) {
  const scrollRef = useScrollToTop([park]);
  const [lineup, setLineup] = useState<ParkLineupResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const getParkLineup = useAction(api.coasters.getParkLineup);

  useEffect(() => {
    let cancelled = false;

    const loadLineup = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const result = (await getParkLineup({ park })) as ParkLineupResponse;
        if (!cancelled) {
          setLineup(result);
        }
      } catch (error: any) {
        if (cancelled) return;
        setLineup(null);
        setLoadError(getErrorMessage(error, "Could not load this park right now"));
        toast.error(getErrorMessage(error, "Could not load this park right now"));
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadLineup();

    return () => {
      cancelled = true;
    };
  }, [getParkLineup, park]);

  const displayLineup = lineup ?? {
    park,
    location: initialLocation ?? "",
    source: "coasterpedia" as const,
    sourceUrl: initialSourceUrl,
    coasters: [],
  };
  const localCoasterIds = useMemo(
    () =>
      displayLineup.coasters
        .map((coaster) => coaster._id)
        .filter((coasterId): coasterId is string => Boolean(coasterId)),
    [displayLineup.coasters],
  );
  const myStatsByCoasterId = useQuery(
    api.coasters.getMyStatsForCoasters,
    localCoasterIds.length > 0 ? { coasterIds: localCoasterIds as any } : "skip",
  ) as
    | Record<
        string,
        {
          rideCount: number;
          currentRank: number | null;
          currentScore: number | null;
        }
      >
    | undefined;

  const rankedCount = displayLineup.coasters.filter((coaster) => {
    if (!coaster._id) return false;
    return typeof myStatsByCoasterId?.[coaster._id]?.currentScore === "number";
  }).length;
  const riddenCount = displayLineup.coasters.filter((coaster) => {
    if (!coaster._id) return false;
    return (myStatsByCoasterId?.[coaster._id]?.rideCount ?? 0) > 0;
  }).length;

  return (
    <ModalContainer onClose={onClose} maxWidth="2xl" scrollRef={scrollRef}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">
              {displayLineup.park}
            </h3>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
              {displayLineup.coasters.length} coaster{displayLineup.coasters.length === 1 ? "" : "s"}
            </span>
          </div>
          {!!displayLineup.location && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{displayLineup.location}</p>
          )}
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
            {rankedCount} ranked · {riddenCount} ridden
          </p>
          {displayLineup.sourceUrl && (
            <a
              href={displayLineup.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-primary hover:underline"
            >
              View park on Coasterpedia
            </a>
          )}
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      {displayLineup.source === "localFallback" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          Showing only coasters already in CoasterCred for this park. This park&apos;s full lineup could not be loaded from Coasterpedia.
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      ) : loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          {loadError}
        </div>
      ) : displayLineup.coasters.length === 0 ? (
        <div className="surface-card rounded-xl px-4 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
          No coasters are available for this park yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayLineup.coasters.map((coaster) => {
            const stats = coaster._id ? myStatsByCoasterId?.[coaster._id] : undefined;
            return (
              <button
                key={coaster.sourceId ?? coaster._id ?? coaster.name}
                type="button"
                onClick={() => onSelectCoaster(coaster)}
                className="surface-card interactive-lift rounded-xl p-3 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {getCoasterDisplayName(coaster)}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {coaster.location || displayLineup.location || "Location unavailable"}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={getCoasterTypeBadgeClasses(coaster.type)}>{coaster.type}</span>
                    {typeof stats?.currentScore === "number" ? (
                      <ScoreBadge score={stats.currentScore} size="sm" />
                    ) : (stats?.rideCount ?? 0) > 0 ? (
                      <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[11px] font-medium text-green-700 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200">
                        Ridden
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-4 text-gray-400 dark:text-gray-500">
        Coaster data by{" "}
        <a
          href="https://coasterpedia.net/"
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline"
        >
          Coasterpedia
        </a>
        , licensed under CC-BY-SA 3.0.
      </p>
    </ModalContainer>
  );
}
