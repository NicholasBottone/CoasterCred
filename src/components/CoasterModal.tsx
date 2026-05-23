import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { dateInputValueToTimestamp, formatDate, todayDateInputValue } from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";
import { ScoreBadge } from "./ScoreBadge";
import { getCoasterTypeBadgeClasses } from "../lib/badges";
import { Avatar } from "./Avatar";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { ModalCloseButton, ModalContainer } from "./ModalContainer";
import {
  type CoasterModalTarget,
  type CoasterGroupSummary,
  type CoasterSummary,
  getCoasterDisplayName,
  getCoasterParentName,
  getCoasterTrackLabel,
  isCoasterGroupSummary,
} from "../lib/coasterData";

type GroupTrackEntry = {
  coaster: CoasterSummary;
  appStats: {
    uniqueRiderCount: number;
    totalLogCount: number;
  };
  myStats: {
    hasRidden: boolean;
    rideCount: number;
    currentRank: number | null;
    currentScore: number | null;
  };
};

function sortTracks(tracks: CoasterSummary[]) {
  return tracks
    .slice()
    .sort((a, b) => {
      const aIndex = a.trackIndex ?? 0;
      const bIndex = b.trackIndex ?? 0;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.name.localeCompare(b.name);
    });
}

function getTrackKey(coaster: Pick<CoasterSummary, "_id" | "sourceId" | "name" | "trackIndex">) {
  return coaster.sourceId ?? coaster._id ?? `${coaster.name}:${coaster.trackIndex ?? 0}`;
}

function mergeGroupTrackEntries(
  seedTracks: CoasterSummary[],
  localTrackEntries: GroupTrackEntry[] | undefined,
) {
  const localEntryByKey = new Map(
    (localTrackEntries ?? []).map((entry) => [getTrackKey(entry.coaster), entry] as const),
  );

  const merged = sortTracks(seedTracks).map((track) => {
    const localEntry = localEntryByKey.get(getTrackKey(track));
    if (localEntry) {
      return localEntry;
    }

    return {
      coaster: track,
      appStats: {
        uniqueRiderCount: 0,
        totalLogCount: 0,
      },
      myStats: {
        hasRidden: false,
        rideCount: 0,
        currentRank: null,
        currentScore: null,
      },
    };
  });

  for (const entry of localTrackEntries ?? []) {
    if (!merged.some((existingEntry) => getTrackKey(existingEntry.coaster) === getTrackKey(entry.coaster))) {
      merged.push(entry);
    }
  }

  return merged.sort((a, b) => {
    const aIndex = a.coaster.trackIndex ?? 0;
    const bIndex = b.coaster.trackIndex ?? 0;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.coaster.name.localeCompare(b.coaster.name);
  });
}

function buildFallbackGroupSummary(coaster: CoasterModalTarget, tracks: CoasterSummary[]): CoasterGroupSummary | null {
  if (isCoasterGroupSummary(coaster)) {
    return coaster;
  }
  if (!coaster.isMultiTrack || !coaster.multiTrackGroupId) {
    return null;
  }

  return {
    kind: "multiTrackGroup",
    name: getCoasterParentName(coaster),
    parentName: getCoasterParentName(coaster),
    park: coaster.park,
    location: coaster.location,
    type: coaster.type,
    source: coaster.source,
    sourcePageId: coaster.sourcePageId ?? coaster.sourceId ?? "",
    sourceUrl: coaster.sourceUrl,
    isMultiTrack: true,
    multiTrackGroupId: coaster.multiTrackGroupId,
    tracks: tracks.length > 0 ? tracks : [coaster],
  };
}

export function CoasterModal({
  coaster,
  onClose,
}: {
  coaster: CoasterModalTarget;
  onClose: () => void;
}) {
  const isGroupedRide = isCoasterGroupSummary(coaster) || Boolean(!isCoasterGroupSummary(coaster) && coaster.isMultiTrack);
  const seedTracks = useMemo(() => {
    if (isCoasterGroupSummary(coaster)) {
      return sortTracks(coaster.tracks);
    }
    return isGroupedRide ? [coaster] : [];
  }, [coaster, isGroupedRide]);
  const fallbackGroupSummary = useMemo(() => buildFallbackGroupSummary(coaster, seedTracks), [coaster, seedTracks]);
  const [selectedTrackKey, setSelectedTrackKey] = useState<string | null>(
    seedTracks[0] ? getTrackKey(seedTracks[0]) : null,
  );
  const scrollRef = useScrollToTop([
    isCoasterGroupSummary(coaster) ? coaster.multiTrackGroupId : coaster._id,
    selectedTrackKey,
  ]);

  const [notes, setNotes] = useState("");
  const [rideDate, setRideDate] = useState(todayDateInputValue());
  const [saving, setSaving] = useState(false);
  const [comparisonBounds, setComparisonBounds] = useState<{ low: number; high: number } | null>(null);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isRideHistoryOpen, setIsRideHistoryOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [showAllFollowedRiders, setShowAllFollowedRiders] = useState(false);
  const [rideHistoryLimit, setRideHistoryLimit] = useState(10);
  const [shouldLoadComparisonList, setShouldLoadComparisonList] = useState(false);
  const [isRerankRequested, setIsRerankRequested] = useState(false);

  const groupData = useQuery(
    api.coasters.getMultiTrackGroupData,
    isGroupedRide && fallbackGroupSummary?.multiTrackGroupId
      ? { multiTrackGroupId: fallbackGroupSummary.multiTrackGroupId }
      : "skip",
  ) as
    | {
        parent: Omit<CoasterGroupSummary, "tracks">;
        aggregateStats: {
          uniqueRiderCount: number;
          totalLogCount: number;
          totalRideCount: number;
          tracksRiddenCount: number;
          tracksRankedCount: number;
        };
        tracks: GroupTrackEntry[];
      }
    | null
    | undefined;

  const groupTrackEntries = useMemo(
    () => mergeGroupTrackEntries(seedTracks, groupData?.tracks),
    [groupData?.tracks, seedTracks],
  );
  const selectedTrackEntry =
    groupTrackEntries.find((entry) => getTrackKey(entry.coaster) === selectedTrackKey) ?? groupTrackEntries[0] ?? null;
  const selectedTrack = selectedTrackEntry?.coaster ?? (isCoasterGroupSummary(coaster) ? null : coaster);
  const groupParent = groupData?.parent ?? fallbackGroupSummary;

  useEffect(() => {
    setSelectedTrackKey(seedTracks[0] ? getTrackKey(seedTracks[0]) : null);
  }, [coaster, seedTracks]);

  useEffect(() => {
    if (!selectedTrack) return;
    setNotes("");
    setRideDate(todayDateInputValue());
    setComparisonBounds(null);
    setIsLogOpen(false);
    setIsRideHistoryOpen(false);
    setIsFriendsOpen(false);
    setShowAllFollowedRiders(false);
    setRideHistoryLimit(10);
    setShouldLoadComparisonList(false);
    setIsRerankRequested(false);
  }, [selectedTrack?._id, selectedTrack?.sourceId, selectedTrack?.imageUrl]);

  const profileData = useQuery(
    api.coasters.getCoasterProfile,
    selectedTrack
      ? {
          coasterId: selectedTrack._id ? (selectedTrack._id as any) : undefined,
          source: selectedTrack.source,
          sourceId: selectedTrack.sourceId,
        }
      : "skip",
  );
  const currentLocalCoasterId = (profileData?.localCoaster?._id as string | undefined) ?? selectedTrack?._id;
  const friendSummary = useQuery(
    api.coasters.getCoasterFriendSummary,
    currentLocalCoasterId ? { coasterId: currentLocalCoasterId as any } : "skip",
  );
  const rideHistory = useQuery(
    api.rideLogs.getMyLogsForCoaster,
    currentLocalCoasterId && isRideHistoryOpen
      ? { coasterId: currentLocalCoasterId as any, limit: rideHistoryLimit }
      : "skip",
  );
  const followedRiders = useQuery(
    api.coasters.getCoasterFollowedRiders,
    currentLocalCoasterId && isFriendsOpen ? { coasterId: currentLocalCoasterId as any } : "skip",
  );
  const comparisonRankings = useQuery(
    api.rankings.getMyRankingComparisonList,
    shouldLoadComparisonList ? {} : "skip",
  );
  const saveRideWithRank = useMutation(api.rankings.saveRideWithRank);
  const removeLog = useMutation(api.rideLogs.removeLog);
  const materializeCoaster = useAction(api.coasters.materializeCoasterpediaCoaster);

  const loadingData =
    selectedTrack !== null &&
    (profileData === undefined ||
      (currentLocalCoasterId !== undefined && profileData?.myStats === undefined));
  const loadingComparison = shouldLoadComparisonList && comparisonRankings === undefined;

  const displayCoaster = (profileData?.localCoaster as CoasterSummary | null) ?? selectedTrack;
  const loadedRideHistory = rideHistory ?? [];
  const loadedFollowedRiders = followedRiders ?? [];
  const visibleFollowedRiders = showAllFollowedRiders ? loadedFollowedRiders : loadedFollowedRiders.slice(0, 5);

  const rankedCoasters = useMemo(
    () => (comparisonRankings ?? []).filter((item: any) => item.coasterId !== currentLocalCoasterId),
    [comparisonRankings, currentLocalCoasterId],
  );

  const hasCurrentRank = typeof profileData?.myStats?.currentRank === "number";
  const comparisonIndex =
    comparisonBounds === null
      ? null
      : Math.floor((comparisonBounds.low + comparisonBounds.high) / 2);
  const comparisonTarget =
    comparisonIndex === null ? null : rankedCoasters[comparisonIndex];

  const ensureLocalCoasterId = async () => {
    if (currentLocalCoasterId) return currentLocalCoasterId;
    if (selectedTrack?.source === "coasterpedia" && selectedTrack.sourceId) {
      return (await materializeCoaster({ sourceId: selectedTrack.sourceId })) as string;
    }
    throw new Error("Could not create a local coaster record");
  };

  const saveRide = async (targetRank?: number) => {
    if (!selectedTrack) return;

    setSaving(true);
    try {
      const coasterId = await ensureLocalCoasterId();
      await saveRideWithRank({
        coasterId: coasterId as any,
        riddenAt: dateInputValueToTimestamp(rideDate),
        rideDate,
        notes: notes || undefined,
        targetRank,
      });
      toast.success(
        typeof profileData?.myStats?.currentRank === "number" && targetRank === undefined
          ? "Ride added to your history!"
          : "Ride logged and ranked!",
      );
      onClose();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not log ride"));
    } finally {
      setSaving(false);
    }
  };

  const startComparisonFlow = async () => {
    if (loadingData || !selectedTrack) return;

    setIsLogOpen(true);
    setShouldLoadComparisonList(true);

    if (typeof profileData?.myStats?.currentRank === "number") {
      await saveRide();
    }
  };

  useEffect(() => {
    if (!isLogOpen || !shouldLoadComparisonList || hasCurrentRank || loadingComparison || saving) {
      return;
    }
    if (comparisonBounds !== null) {
      return;
    }
    if (!comparisonRankings) {
      return;
    }
    if (rankedCoasters.length === 0) {
      void saveRide(1);
      return;
    }
    setComparisonBounds({ low: 0, high: rankedCoasters.length });
  }, [
    comparisonBounds,
    comparisonRankings,
    hasCurrentRank,
    isLogOpen,
    loadingComparison,
    rankedCoasters.length,
    saving,
    shouldLoadComparisonList,
  ]);

  useEffect(() => {
    if (!isLogOpen || !isRerankRequested || loadingComparison || comparisonBounds !== null) {
      return;
    }
    if (!comparisonRankings || rankedCoasters.length === 0) {
      return;
    }
    setComparisonBounds({ low: 0, high: rankedCoasters.length });
    setIsRerankRequested(false);
  }, [
    comparisonBounds,
    comparisonRankings,
    isLogOpen,
    isRerankRequested,
    loadingComparison,
    rankedCoasters.length,
  ]);

  const handleComparisonChoice = async (winner: "selected" | "other") => {
    if (comparisonBounds === null || comparisonTarget === null) return;

    const mid = Math.floor((comparisonBounds.low + comparisonBounds.high) / 2);
    const nextBounds =
      winner === "selected"
        ? { low: comparisonBounds.low, high: mid }
        : { low: mid + 1, high: comparisonBounds.high };

    if (nextBounds.low >= nextBounds.high) {
      await saveRide(nextBounds.low + 1);
      return;
    }

    setComparisonBounds(nextBounds);
  };

  const handleRemove = async (logId: string) => {
    setSaving(true);
    try {
      await removeLog({ logId: logId as any });
      toast.success("Ride removed");
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not remove ride"));
    } finally {
      setSaving(false);
    }
  };

  const toggleLogSection = () => {
    if (comparisonBounds !== null) {
      setComparisonBounds(null);
    }
    if (isLogOpen) {
      setShouldLoadComparisonList(false);
      setIsRerankRequested(false);
    }
    setIsLogOpen((current) => !current);
  };

  const aggregateStats =
    groupData?.aggregateStats ??
    (groupParent
      ? {
          uniqueRiderCount: 0,
          totalLogCount: groupTrackEntries.reduce((sum, entry) => sum + entry.appStats.totalLogCount, 0),
          totalRideCount: groupTrackEntries.reduce((sum, entry) => sum + entry.myStats.rideCount, 0),
          tracksRiddenCount: groupTrackEntries.filter((entry) => entry.myStats.hasRidden).length,
          tracksRankedCount: groupTrackEntries.filter((entry) => typeof entry.myStats.currentRank === "number").length,
        }
      : null);
  const selectedTrackLabel = displayCoaster ? getCoasterTrackLabel(displayCoaster) : null;

  return (
    <ModalContainer onClose={onClose} maxWidth="2xl" scrollRef={scrollRef}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">
              {groupParent ? groupParent.name : displayCoaster ? getCoasterDisplayName(displayCoaster) : "Coaster"}
            </h3>
            <span className={getCoasterTypeBadgeClasses(groupParent?.type ?? displayCoaster?.type)}>
              {groupParent?.type ?? displayCoaster?.type}
            </span>
            {groupParent && (
              <span className="rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300">
                {groupTrackEntries.length} track{groupTrackEntries.length === 1 ? "" : "s"}
              </span>
            )}
            {displayCoaster?.status && displayCoaster.status.toLowerCase() !== "operating" && (
              <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                {displayCoaster.status}
              </span>
            )}
            {!groupParent && typeof profileData?.myStats?.currentScore === "number" && (
              <ScoreBadge score={profileData.myStats.currentScore} size="sm" />
            )}
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {(groupParent?.park ?? displayCoaster?.park) ?? "Unknown park"} · {(groupParent?.location ?? displayCoaster?.location) ?? "Unknown location"}
          </p>
          {(groupParent?.sourceUrl ?? displayCoaster?.sourceUrl) && (
            <a
              href={groupParent?.sourceUrl ?? displayCoaster?.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block text-xs text-primary hover:underline"
            >
              View on Coasterpedia
            </a>
          )}
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      {groupParent && aggregateStats && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Unique riders" value={aggregateStats.uniqueRiderCount} />
            <Metric label="Total logs" value={aggregateStats.totalLogCount} />
            <Metric label="My rides" value={aggregateStats.totalRideCount} />
            <Metric label="Tracks ridden" value={`${aggregateStats.tracksRiddenCount}/${groupTrackEntries.length}`} />
          </div>

          <section className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950/40">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Tracks</h4>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Select a specific track to view stats, history, and logging options.
                </p>
              </div>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">
                {aggregateStats.tracksRankedCount} ranked
              </span>
            </div>

            <div className="mt-3 flex flex-col gap-2">
              {groupTrackEntries.map((entry) => {
                const isSelected = getTrackKey(entry.coaster) === selectedTrackKey;
                const trackLabel = getCoasterTrackLabel(entry.coaster) ?? getCoasterDisplayName(entry.coaster);

                return (
                  <div
                    key={getTrackKey(entry.coaster)}
                    className={`rounded-xl border px-3 py-3 transition-all ${
                      isSelected
                        ? "border-primary/40 bg-primary/5 dark:bg-primary/10"
                        : "surface-subtle border-transparent"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        onClick={() => setSelectedTrackKey(getTrackKey(entry.coaster))}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{trackLabel}</p>
                          {isSelected && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] uppercase tracking-wide text-white">
                              Selected
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                          {entry.myStats.rideCount} ride{entry.myStats.rideCount === 1 ? "" : "s"}
                          {typeof entry.myStats.currentRank === "number" ? ` · #${entry.myStats.currentRank}` : " · Not ranked"}
                        </p>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {typeof entry.myStats.currentScore === "number" ? (
                          <ScoreBadge score={entry.myStats.currentScore} size="sm" />
                        ) : (
                          <span className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                            {entry.appStats.totalLogCount} logs
                          </span>
                        )}
                        <button
                          onClick={() => {
                            setSelectedTrackKey(getTrackKey(entry.coaster));
                            setIsLogOpen(true);
                          }}
                          className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5 dark:hover:bg-primary/10"
                        >
                          Log ride
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}

      {displayCoaster && groupParent && (
        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300">
          Viewing track: <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedTrackLabel ?? getCoasterDisplayName(displayCoaster)}</span>
        </div>
      )}

      {displayCoaster && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {displayCoaster.heightFt && <Stat label="Height" value={`${displayCoaster.heightFt}ft`} />}
            {displayCoaster.speedMph && <Stat label="Speed" value={`${displayCoaster.speedMph}mph`} />}
            {displayCoaster.inversions !== undefined && <Stat label="Inversions" value={displayCoaster.inversions} />}
            {displayCoaster.lengthFt && <Stat label="Length" value={`${displayCoaster.lengthFt}ft`} />}
            {displayCoaster.yearOpened && <Stat label="Opened" value={displayCoaster.yearOpened} />}
            {displayCoaster.manufacturer && <Stat label="Maker" value={displayCoaster.manufacturer} />}
            {displayCoaster.product && <Stat label="Product" value={displayCoaster.product} />}
            {displayCoaster.propulsion && <Stat label="Propulsion" value={displayCoaster.propulsion} />}
            {displayCoaster.durationSeconds !== undefined && (
              <Stat label="Duration" value={`${displayCoaster.durationSeconds}s`} />
            )}
          </div>

          <div className="mb-4 grid gap-4 md:grid-cols-2">
            <section className="surface-subtle p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {groupParent ? "Selected track on CoasterCred" : "On CoasterCred"}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Unique riders" value={profileData?.appStats?.uniqueRiderCount ?? 0} />
                <Metric label="Total logs" value={profileData?.appStats?.totalLogCount ?? 0} />
                <Metric label="Followed riders" value={friendSummary?.followedRiderCount ?? 0} />
                <Metric
                  label="Friends avg"
                  value={
                    typeof friendSummary?.averageFollowedScore === "number"
                      ? friendSummary.averageFollowedScore.toFixed(1)
                      : "—"
                  }
                />
              </div>
            </section>

            <section className="surface-subtle p-4 flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {groupParent ? "Your selected track status" : "Your status"}
                </h4>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Ride count" value={profileData?.myStats?.rideCount ?? 0} />
                <Metric
                  label="Rank"
                  value={
                    typeof profileData?.myStats?.currentRank === "number"
                      ? `#${profileData.myStats.currentRank}`
                      : "—"
                  }
                />
              </div>
            </section>
          </div>

          <section className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950/40">
            <button
              onClick={() => setIsFriendsOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Friends who rode this</h4>
              </div>
              <ExpandIcon isOpen={isFriendsOpen} />
            </button>

            {isFriendsOpen && (
              <div className="mt-3">
                {loadedFollowedRiders === undefined ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading followed riders...</p>
                ) : loadedFollowedRiders.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">None of the riders you follow have logged this yet.</p>
                ) : (
                  <>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {loadedFollowedRiders.length} followed rider{loadedFollowedRiders.length === 1 ? "" : "s"}
                      </p>
                      {loadedFollowedRiders.length > 5 && (
                        <button
                          onClick={() => setShowAllFollowedRiders((current) => !current)}
                          className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                        >
                          {showAllFollowedRiders ? "Show less" : `View all (${loadedFollowedRiders.length})`}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      {visibleFollowedRiders.map((entry: any) => (
                        <div
                          key={entry.user._id}
                          className="surface-subtle flex items-center gap-3 px-3 py-3"
                        >
                          <Avatar
                            avatarUrl={entry.profile?.avatarUrl}
                            name={entry.user?.name}
                            sizeClassName="w-9 h-9"
                            textClassName="text-sm"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                              {entry.user?.name ?? "Unknown rider"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {entry.lastRideDate ? `Last ride ${formatDate(entry.lastRideDate)}` : "Ride date unavailable"}
                              {typeof entry.rank === "number" ? ` · #${entry.rank}` : ""}
                            </p>
                          </div>
                          {typeof entry.score === "number" ? (
                            <ScoreBadge score={entry.score} size="sm" />
                          ) : (
                            <span className="rounded-full border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-500 dark:border-gray-700 dark:text-gray-400">
                              {entry.rideCount} ride{entry.rideCount === 1 ? "" : "s"}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </section>

          <section className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-4 dark:border-gray-800 dark:bg-gray-950/40">
            <button
              onClick={() => setIsRideHistoryOpen((current) => !current)}
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">My ride history</h4>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {profileData?.myStats?.rideCount ?? 0} total ride{(profileData?.myStats?.rideCount ?? 0) === 1 ? "" : "s"} for this coaster
                </p>
              </div>
              <ExpandIcon isOpen={isRideHistoryOpen} />
            </button>

            {isRideHistoryOpen && (
              <div className="mt-3">
                {loadedRideHistory === undefined ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Loading ride history...</p>
                ) : loadedRideHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No rides logged yet.</p>
                ) : (
                  <>
                    <div className="flex max-h-40 flex-col gap-2 overflow-y-auto">
                      {loadedRideHistory.map((log: any) => (
                        <div key={log._id} className="surface-subtle interactive-lift flex items-start gap-3 px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 dark:text-gray-100">{formatDate(log.rideDate)}</p>
                            {log.notes && (
                              <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">{log.notes}</p>
                            )}
                          </div>
                          <button
                            onClick={() => void handleRemove(log._id)}
                            disabled={saving}
                            className="text-xs font-medium text-red-500 transition-colors hover:text-red-400 disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      ))}
                    </div>
                    {(profileData?.myStats?.rideCount ?? 0) > loadedRideHistory.length && (
                      <button
                        onClick={() => setRideHistoryLimit((current) => current + 10)}
                        className="mt-3 text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                      >
                        Show 10 more rides
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950/40">
            <button
              onClick={toggleLogSection}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/70"
            >
              <div>
                <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {groupParent ? `Log ${selectedTrackLabel ?? "track"}` : "Log Ride"}
                </h4>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {profileData?.myStats?.hasRidden
                    ? "Add another ride or update where this coaster belongs in your list"
                    : "Log your first ride and place it in your rankings"}
                </p>
              </div>
              <ExpandIcon isOpen={isLogOpen} />
            </button>

            {isLogOpen && (
              <div className="border-t border-gray-200 px-4 py-4 dark:border-gray-800">
                {typeof profileData?.myStats?.currentRank === "number" && (
                  <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
                    Currently ranked #{profileData.myStats.currentRank}
                    {typeof profileData?.myStats?.currentScore === "number"
                      ? ` with a ${profileData.myStats.currentScore.toFixed(1)}`
                      : ""}
                    .
                  </p>
                )}

                <div className="mb-3">
                  <label className="mb-1 block text-xs text-gray-500 dark:text-gray-400">Ride date</label>
                  <input
                    type="date"
                    value={rideDate}
                    max={todayDateInputValue()}
                    onChange={(e) => setRideDate(e.target.value)}
                    className="date-input-field"
                  />
                </div>

                <textarea
                  placeholder="Notes (optional)..."
                  value={notes}
                  maxLength={500}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="input-field mb-3 resize-none"
                />

                {loadingData ? (
                  <div className="mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    Loading your current rankings...
                  </div>
                ) : loadingComparison ? (
                  <div className="mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    Loading the ranking comparison list...
                  </div>
                ) : comparisonTarget ? (
                  <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-800 dark:bg-gray-900">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Which coaster is better?
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => void handleComparisonChoice("selected")}
                        disabled={saving}
                        className="rounded-xl border border-primary/20 bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-1 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md disabled:opacity-50 dark:border-primary/30 dark:bg-gray-950 dark:hover:bg-primary/10"
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {displayCoaster ? getCoasterDisplayName(displayCoaster) : "Selected coaster"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{displayCoaster?.park}</p>
                      </button>
                      <button
                        onClick={() => void handleComparisonChoice("other")}
                        disabled={saving}
                        className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-left shadow-sm transition hover:-translate-y-1 hover:border-gray-300 hover:bg-gray-100 hover:shadow-md disabled:opacity-50 dark:border-gray-700 dark:bg-gray-950 dark:hover:bg-gray-800"
                      >
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                          {comparisonTarget.coaster?.name ?? "Unknown"}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{comparisonTarget.coaster?.park}</p>
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Pick the coaster you’d place higher in your personal rankings.
                    </p>
                  </div>
                ) : (
                  <div className="mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    {hasCurrentRank
                      ? "Logging another ride adds it to your history. Use Re-rank if you want to move it in your list."
                      : shouldLoadComparisonList && rankedCoasters.length === 0
                        ? "This will become your first ranked coaster."
                        : shouldLoadComparisonList
                          ? "Working out where this coaster belongs in your list."
                          : "Open the comparison flow to place this coaster into your list."}
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => void startComparisonFlow()}
                    disabled={saving || loadingData}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md disabled:opacity-50"
                  >
                    {comparisonTarget
                      ? "Restart Comparisons"
                      : hasCurrentRank
                        ? "Log Ride"
                        : "Log and Rank Ride"}
                  </button>
                  {hasCurrentRank && (
                    <button
                      onClick={() => {
                        setIsLogOpen(true);
                        setIsRerankRequested(true);
                        setShouldLoadComparisonList(true);
                        if (rankedCoasters.length > 0) {
                          setComparisonBounds({ low: 0, high: rankedCoasters.length });
                        }
                      }}
                      disabled={saving || loadingComparison}
                      className="rounded-xl border border-primary/30 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/5 dark:hover:bg-primary/10 disabled:opacity-50"
                    >
                      Re-rank
                    </button>
                  )}
                </div>
              </div>
            )}
          </section>
        </>
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

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-subtle p-2 flex flex-col justify-center items-center text-center">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center dark:border-gray-800 dark:bg-gray-950">
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function ExpandIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
      width="32px"
      height="32px"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 10L12 15L17 10"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
