import { useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { flushSync } from "react-dom";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { CoasterModal } from "../components/CoasterModal";
import {
  type CoasterGroupSummary,
  type CoasterModalTarget,
  type CoasterSummary,
  getCoasterDisplayName,
  isCoasterGroupSummary,
} from "../lib/coasterData";
import { getErrorMessage } from "../lib/errors";
import { getCoasterTypeBadgeClasses } from "../lib/badges";
import { MemberSearchPanel } from "../components/MemberSearchPanel";

function focusSearchInput() {
  const input = document.querySelector<HTMLInputElement>('[data-search-autofocus="true"]');
  input?.focus();
  input?.select();
}

export function SearchPage() {
  const [mode, setMode] = useState<"coasters" | "members">("coasters");
  const viewerShell = useQuery(api.profiles.getViewerShell);

  const handleSelectMode = (nextMode: "coasters" | "members") => {
    flushSync(() => {
      setMode(nextMode);
    });
    focusSearchInput();
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-4">
        <div className="mt-3 grid grid-cols-2 gap-2">
          {([
            { id: "coasters", label: "Coasters" },
            { id: "members", label: "Members" },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelectMode(option.id)}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                mode === option.id
                  ? "bg-primary text-white shadow-sm"
                  : "surface-subtle interactive-lift text-gray-700 dark:text-gray-200"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "coasters" ? (
        <CoasterSearchPanel />
      ) : (
        <MemberSearchPanel
          viewerUserId={viewerShell?.user?._id ?? null}
          autoFocus
        />
      )}
    </div>
  );
}

function CoasterSearchPanel() {
  const [search, setSearch] = useState("");
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterModalTarget | null>(null);
  const [results, setResults] = useState<Array<CoasterSummary | CoasterGroupSummary>>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const topCoasters = useQuery(api.coasters.getTopCoasters);
  const searchCoasterpedia = useAction(api.coasters.searchCoasterpedia);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const queryText = search.trim();
    if (!queryText) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const nextResults = await searchCoasterpedia({ q: queryText });
        if (!cancelled) {
          setResults(nextResults as Array<CoasterSummary | CoasterGroupSummary>);
        }
      } catch (error: any) {
        if (!cancelled) {
          setResults([]);
          toast.error(getErrorMessage(error, "Could not search coasters"));
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, searchCoasterpedia]);

  const displayResults = search.trim()
    ? results
    : ((topCoasters ?? []) as Array<CoasterSummary | CoasterGroupSummary>);
  const visibleLocalCoasterIds = displayResults.flatMap((result) => {
    if (isCoasterGroupSummary(result)) {
      return result.tracks
        .map((track) => track._id)
        .filter((coasterId): coasterId is string => Boolean(coasterId));
    }

    return result._id ? [result._id] : [];
  });
  const myRideCounts = useQuery(
    api.rideLogs.getMyRideCountsForCoasters,
    visibleLocalCoasterIds.length > 0 ? { coasterIds: visibleLocalCoasterIds as any } : "skip",
  );

  return (
    <>
      <input
        ref={inputRef}
        data-search-autofocus="true"
        type="text"
        placeholder="Search for a coaster"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="input-field mb-2 px-4 py-2.5"
      />
      <div className="mb-4">
        <p className="ui-copy-disabled mt-1 text-xs text-gray-400 dark:text-gray-500">
          Search by coaster name (or coaster name + park) to log a ride.
        </p>
        <p className="ui-copy-disabled mt-1 text-xs text-gray-400 dark:text-gray-500">
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
      </div>
      {searching || (!topCoasters && !search.trim()) ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayResults.map((result) =>
            isCoasterGroupSummary(result) ? (
              <CoasterGroupCard
                key={`group:${result.multiTrackGroupId}`}
                group={result}
                rideCounts={myRideCounts ?? {}}
                onClick={() => setSelectedCoaster(result)}
              />
            ) : (
              <CoasterCard
                key={result._id ?? `${result.source ?? "local"}:${result.sourceId ?? result.name}`}
                coaster={result}
                rideCount={result._id ? myRideCounts?.[result._id] ?? 0 : 0}
                onClick={() => setSelectedCoaster(result)}
              />
            ),
          )}
          {displayResults.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
              {search.trim() ? "No coasters found" : "No local coasters yet"}
            </p>
          )}
        </div>
      )}

      {selectedCoaster && <CoasterModal coaster={selectedCoaster} onClose={() => setSelectedCoaster(null)} />}
    </>
  );
}

function CoasterCard({
  coaster,
  rideCount,
  onClick,
}: {
  coaster: CoasterSummary;
  rideCount: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="surface-card interactive-lift rounded-xl p-3 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
              {getCoasterDisplayName(coaster)}
            </p>
            {rideCount > 0 && (
              <span className="text-green-500 text-xs">
                ✓ {rideCount === 1 ? "Ridden" : `${rideCount} rides`}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{coaster.park} · {coaster.location}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={getCoasterTypeBadgeClasses(coaster.type)}>
            {coaster.type}
          </span>
          {coaster.heightFt && (
            <span className="text-xs text-gray-400 dark:text-gray-500">{coaster.heightFt}ft</span>
          )}
        </div>
      </div>
    </button>
  );
}

function CoasterGroupCard({
  group,
  rideCounts,
  onClick,
}: {
  group: CoasterGroupSummary;
  rideCounts: Record<string, number>;
  onClick: () => void;
}) {
  const totalRideCount = group.tracks.reduce((sum, track) => sum + (track._id ? rideCounts[track._id] ?? 0 : 0), 0);
  const riddenTrackCount = group.tracks.filter((track) => track._id && (rideCounts[track._id] ?? 0) > 0).length;

  return (
    <button
      onClick={onClick}
      className="surface-card interactive-lift rounded-xl p-3 text-left"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{group.name}</p>
            {totalRideCount > 0 && (
              <span className="text-green-500 text-xs">
                ✓ {totalRideCount === 1 ? "1 ride" : `${totalRideCount} rides`}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{group.park} · {group.location}</p>
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
            {group.tracks.length} tracks
            {riddenTrackCount > 0 ? ` · ${riddenTrackCount} ridden` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={getCoasterTypeBadgeClasses(group.type)}>
            {group.type}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">Multi-track ride</span>
        </div>
      </div>
    </button>
  );
}
