import {
  CoasterDetailHeader,
  CoasterSpecifications,
  DetailMetric as Metric,
  DetailSection,
} from "./DetailSheet";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { normalizeCoasterLocation } from "../../convex/coasterLocation";
import { toast } from "sonner";
import {
  dateInputValueToTimestamp,
  formatDate,
  todayDateInputValue,
} from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";
import { ScoreBadge } from "./ScoreBadge";
import { getCoasterMaterialClasses } from "../lib/badges";
import { Avatar } from "./Avatar";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { ModalCloseButton, ModalContainer } from "./ModalContainer";
import { ParkModal } from "./ParkModal";
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

type EditingLogState = {
  id: string;
  rideDate: string;
  notes: string;
};

function sortTracks(tracks: CoasterSummary[]) {
  return tracks.slice().sort((a, b) => {
    const aIndex = a.trackIndex ?? 0;
    const bIndex = b.trackIndex ?? 0;
    if (aIndex !== bIndex) return aIndex - bIndex;
    return a.name.localeCompare(b.name);
  });
}

function getTrackKey(
  coaster: Pick<
    CoasterSummary,
    "_id" | "sourceId" | "name" | "trackIndex" | "multiTrackGroupId"
  >,
) {
  if (coaster.multiTrackGroupId && typeof coaster.trackIndex === "number") {
    return `${coaster.multiTrackGroupId}:${coaster.trackIndex}`;
  }

  return (
    coaster.sourceId ??
    coaster._id ??
    `${coaster.name}:${coaster.trackIndex ?? 0}`
  );
}

function mergeGroupTrackEntries(
  seedTracks: CoasterSummary[],
  localTrackEntries: GroupTrackEntry[] | undefined,
  groupId?: string,
) {
  const seedTrackKeys = new Set(seedTracks.map((track) => getTrackKey(track)));
  const relevantLocalTrackEntries = (localTrackEntries ?? []).filter(
    (entry) => {
      if (seedTrackKeys.has(getTrackKey(entry.coaster))) {
        return true;
      }

      if (!groupId) {
        return true;
      }

      return entry.coaster.multiTrackGroupId === groupId;
    },
  );
  const localEntryByKey = new Map(
    relevantLocalTrackEntries.map(
      (entry) => [getTrackKey(entry.coaster), entry] as const,
    ),
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

  for (const entry of relevantLocalTrackEntries) {
    if (
      !merged.some(
        (existingEntry) =>
          getTrackKey(existingEntry.coaster) === getTrackKey(entry.coaster),
      )
    ) {
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

function buildFallbackGroupSummary(
  coaster: CoasterModalTarget,
  tracks: CoasterSummary[],
): CoasterGroupSummary | null {
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
  initialSelectedTrackKey,
  onClose,
}: {
  coaster: CoasterModalTarget;
  initialSelectedTrackKey?: string | null;
  onClose: () => void;
}) {
  const isGroupedRide =
    isCoasterGroupSummary(coaster) ||
    Boolean(!isCoasterGroupSummary(coaster) && coaster.isMultiTrack);
  const seedTracks = useMemo(() => {
    if (isCoasterGroupSummary(coaster)) {
      return sortTracks(coaster.tracks);
    }
    return isGroupedRide ? [coaster] : [];
  }, [coaster, isGroupedRide]);
  const fallbackGroupSummary = useMemo(
    () => buildFallbackGroupSummary(coaster, seedTracks),
    [coaster, seedTracks],
  );
  const resolvedInitialTrackKey = useMemo(() => {
    if (
      initialSelectedTrackKey &&
      seedTracks.some((track) => getTrackKey(track) === initialSelectedTrackKey)
    ) {
      return initialSelectedTrackKey;
    }

    return seedTracks[0] ? getTrackKey(seedTracks[0]) : null;
  }, [initialSelectedTrackKey, seedTracks]);
  const [selectedTrackKey, setSelectedTrackKey] = useState<string | null>(
    resolvedInitialTrackKey,
  );
  const scrollRef = useScrollToTop([
    isCoasterGroupSummary(coaster) ? coaster.multiTrackGroupId : coaster._id,
  ]);

  const [notes, setNotes] = useState("");
  const [rideDate, setRideDate] = useState(todayDateInputValue());
  const [saving, setSaving] = useState(false);
  const [comparisonBounds, setComparisonBounds] = useState<{
    low: number;
    high: number;
  } | null>(null);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isRideHistoryOpen, setIsRideHistoryOpen] = useState(false);
  const [isFriendsOpen, setIsFriendsOpen] = useState(false);
  const [showAllFollowedRiders, setShowAllFollowedRiders] = useState(false);
  const [rideHistoryLimit, setRideHistoryLimit] = useState(10);
  const [shouldLoadComparisonList, setShouldLoadComparisonList] =
    useState(false);
  const [isRerankRequested, setIsRerankRequested] = useState(false);
  const [editingLog, setEditingLog] = useState<EditingLogState | null>(null);
  const [selectedPark, setSelectedPark] = useState<{
    park: string;
    location?: string;
    sourceUrl?: string;
  } | null>(null);
  const [drilldownCoaster, setDrilldownCoaster] = useState<{
    coaster: CoasterModalTarget;
    initialSelectedTrackKey?: string | null;
  } | null>(null);
  const pendingLogModalOpenRef = useRef(false);

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
    () =>
      mergeGroupTrackEntries(
        seedTracks,
        groupData?.tracks,
        fallbackGroupSummary?.multiTrackGroupId,
      ),
    [fallbackGroupSummary?.multiTrackGroupId, groupData?.tracks, seedTracks],
  );
  const selectedTrackEntry =
    groupTrackEntries.find(
      (entry) => getTrackKey(entry.coaster) === selectedTrackKey,
    ) ??
    groupTrackEntries[0] ??
    null;
  const selectedTrack =
    selectedTrackEntry?.coaster ??
    (isCoasterGroupSummary(coaster) ? null : coaster);
  const groupParent = groupData?.parent ?? fallbackGroupSummary;

  useEffect(() => {
    setSelectedTrackKey(resolvedInitialTrackKey);
  }, [coaster, resolvedInitialTrackKey]);

  useEffect(() => {
    if (!selectedTrack) return;
    resetLogState(pendingLogModalOpenRef.current);
    setIsRideHistoryOpen(false);
    setIsFriendsOpen(false);
    setShowAllFollowedRiders(false);
    setRideHistoryLimit(10);
    pendingLogModalOpenRef.current = false;
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
  const currentLocalCoasterId =
    (profileData?.localCoaster?._id as string | undefined) ??
    selectedTrack?._id;
  const friendSummary = useQuery(
    api.coasters.getCoasterFriendSummary,
    currentLocalCoasterId
      ? { coasterId: currentLocalCoasterId as any }
      : "skip",
  );
  const rideHistory = useQuery(
    api.rideLogs.getMyLogsForCoaster,
    currentLocalCoasterId && isRideHistoryOpen
      ? { coasterId: currentLocalCoasterId as any, limit: rideHistoryLimit }
      : "skip",
  );
  const followedRiders = useQuery(
    api.coasters.getCoasterFollowedRiders,
    currentLocalCoasterId && isFriendsOpen
      ? { coasterId: currentLocalCoasterId as any }
      : "skip",
  );
  const comparisonRankings = useQuery(
    api.rankings.getMyRankingComparisonList,
    shouldLoadComparisonList ? {} : "skip",
  );
  const saveRideWithRank = useMutation(api.rankings.saveRideWithRank);
  const updateLog = useMutation(api.rideLogs.updateLog);
  const removeLog = useMutation(api.rideLogs.removeLog);
  const materializeCoaster = useAction(
    api.coasters.materializeCoasterpediaCoaster,
  );

  const loadingData =
    selectedTrack !== null &&
    (profileData === undefined ||
      (currentLocalCoasterId !== undefined &&
        profileData?.myStats === undefined));
  const loadingComparison =
    shouldLoadComparisonList && comparisonRankings === undefined;

  const displayCoaster =
    (profileData?.localCoaster as CoasterSummary | null) ?? selectedTrack;
  const loadedRideHistory = rideHistory ?? [];
  const loadedFollowedRiders = followedRiders ?? [];
  const visibleFollowedRiders = showAllFollowedRiders
    ? loadedFollowedRiders
    : loadedFollowedRiders.slice(0, 5);

  const rankedCoasters = useMemo(
    () =>
      (comparisonRankings ?? []).filter(
        (item: any) => item.coasterId !== currentLocalCoasterId,
      ),
    [comparisonRankings, currentLocalCoasterId],
  );

  const hasCurrentRank = typeof profileData?.myStats?.currentRank === "number";
  const comparisonIndex =
    comparisonBounds === null
      ? null
      : Math.floor((comparisonBounds.low + comparisonBounds.high) / 2);
  const comparisonTarget =
    comparisonIndex === null ? null : rankedCoasters[comparisonIndex];
  const isEditingLog = editingLog !== null;

  const ensureLocalCoasterId = async () => {
    if (currentLocalCoasterId) return currentLocalCoasterId;
    if (selectedTrack?.source === "coasterpedia" && selectedTrack.sourceId) {
      return (await materializeCoaster({
        sourceId: selectedTrack.sourceId,
      })) as string;
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
        typeof profileData?.myStats?.currentRank === "number" &&
          targetRank === undefined
          ? "Ride added to your history!"
          : "Ride logged and ranked!",
      );
      resetLogState(false);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not log ride"));
    } finally {
      setSaving(false);
    }
  };

  const saveEditedLog = async () => {
    if (!editingLog) return;

    setSaving(true);
    try {
      await updateLog({
        logId: editingLog.id as any,
        riddenAt: dateInputValueToTimestamp(rideDate),
        rideDate,
        notes: notes || undefined,
      });
      toast.success("Ride log updated");
      resetLogState(false);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not update ride"));
    } finally {
      setSaving(false);
    }
  };

  const startComparisonFlow = async () => {
    if (loadingData || !selectedTrack) return;

    setIsLogModalOpen(true);
    setShouldLoadComparisonList(true);

    if (typeof profileData?.myStats?.currentRank === "number") {
      await saveRide();
    }
  };

  useEffect(() => {
    if (
      !isLogModalOpen ||
      !shouldLoadComparisonList ||
      hasCurrentRank ||
      loadingComparison ||
      saving
    ) {
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
    isLogModalOpen,
    loadingComparison,
    rankedCoasters.length,
    saving,
    shouldLoadComparisonList,
  ]);

  useEffect(() => {
    if (
      !isLogModalOpen ||
      !isRerankRequested ||
      loadingComparison ||
      comparisonBounds !== null
    ) {
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
    isLogModalOpen,
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

  const handleEditLog = (log: {
    _id: string;
    rideDate?: string | null;
    notes?: string | null;
  }) => {
    setEditingLog({
      id: log._id,
      rideDate: log.rideDate ?? todayDateInputValue(),
      notes: log.notes ?? "",
    });
    setRideDate(log.rideDate ?? todayDateInputValue());
    setNotes(log.notes ?? "");
    setComparisonBounds(null);
    setShouldLoadComparisonList(false);
    setIsRerankRequested(false);
    setIsLogModalOpen(true);
  };

  const resetLogState = (nextIsOpen = false) => {
    setNotes("");
    setRideDate(todayDateInputValue());
    setComparisonBounds(null);
    setIsLogModalOpen(nextIsOpen);
    setShouldLoadComparisonList(false);
    setIsRerankRequested(false);
    setEditingLog(null);
  };

  const openLogModal = () => {
    if (!selectedTrack) return;
    resetLogState(true);
  };

  const openLogModalForTrack = (trackKey: string) => {
    if (trackKey === selectedTrackKey) {
      resetLogState(true);
      return;
    }

    pendingLogModalOpenRef.current = true;
    setSelectedTrackKey(trackKey);
  };

  const aggregateStats =
    groupData?.aggregateStats ??
    (groupParent
      ? {
          uniqueRiderCount: 0,
          totalLogCount: groupTrackEntries.reduce(
            (sum, entry) => sum + entry.appStats.totalLogCount,
            0,
          ),
          totalRideCount: groupTrackEntries.reduce(
            (sum, entry) => sum + entry.myStats.rideCount,
            0,
          ),
          tracksRiddenCount: groupTrackEntries.filter(
            (entry) => entry.myStats.hasRidden,
          ).length,
          tracksRankedCount: groupTrackEntries.filter(
            (entry) => typeof entry.myStats.currentRank === "number",
          ).length,
        }
      : null);
  const parkName = groupParent?.park ?? displayCoaster?.park ?? "";
  const parkLocation = normalizeCoasterLocation(
    groupParent?.location ?? displayCoaster?.location ?? "",
    groupParent?.country ?? displayCoaster?.country,
  );
  const parkDisplayLine = [parkName, parkLocation].filter(Boolean).join(" · ");
  const selectedTrackLabel = displayCoaster
    ? getCoasterTrackLabel(displayCoaster)
    : null;
  const logButtonLabel = groupParent
    ? `Log ${selectedTrackLabel ?? "track"}`
    : "Log ride";
  const logModalTitle = isEditingLog
    ? groupParent
      ? `Edit ${selectedTrackLabel ?? "track"} log`
      : "Edit Ride Log"
    : groupParent
      ? `Log ${selectedTrackLabel ?? "track"}`
      : "Log Ride";
  const logModalSubtitle = displayCoaster
    ? `${getCoasterDisplayName(displayCoaster)} · ${displayCoaster.park ?? "Unknown park"}`
    : "Add a ride and place it in your rankings.";

  return (
    <>
      <ModalContainer
        onClose={onClose}
        maxWidth="2xl"
        contentClassName="coaster-sheet"
        scrollRef={scrollRef}
        label={groupParent?.name ?? displayCoaster?.name ?? "Coaster details"}
        suspended={
          isLogModalOpen || selectedPark !== null || drilldownCoaster !== null
        }
      >
        <CoasterDetailHeader
          title={
            groupParent
              ? groupParent.name
              : displayCoaster
                ? getCoasterDisplayName(displayCoaster)
                : "Coaster"
          }
          location={parkDisplayLine || parkName || "Unknown park"}
          onClose={onClose}
          metadata={
            <>
              <span
                className={getCoasterMaterialClasses(
                  groupParent?.type ?? displayCoaster?.type,
                )}
              >
                {groupParent?.type ?? displayCoaster?.type}
              </span>
              {groupParent && (
                <span className="detail-muted text-xs">
                  {groupTrackEntries.length} track
                  {groupTrackEntries.length === 1 ? "" : "s"}
                </span>
              )}
              {displayCoaster?.status &&
                displayCoaster.status.toLowerCase() !== "operating" && (
                  <span className="text-xs text-amber-700 dark:text-amber-300">
                    {displayCoaster.status}
                  </span>
                )}
              {!groupParent &&
                typeof profileData?.myStats?.currentScore === "number" && (
                  <ScoreBadge
                    score={profileData.myStats.currentScore}
                    size="sm"
                  />
                )}
            </>
          }
          logAction={
            displayCoaster && !groupParent ? (
              <LogActionButton
                onClick={openLogModal}
                ariaLabel={logButtonLabel}
              />
            ) : undefined
          }
        />
        {(parkName || groupParent?.sourceUrl || displayCoaster?.sourceUrl) && (
          <div className="detail-header-nav">
            {parkName && (
              <button
                type="button"
                onClick={() =>
                  setSelectedPark({
                    park: parkName,
                    location: parkLocation || undefined,
                  })
                }
                className="detail-link"
              >
                Browse park coasters
              </button>
            )}
            {(groupParent?.sourceUrl ?? displayCoaster?.sourceUrl) && (
              <a
                href={groupParent?.sourceUrl ?? displayCoaster?.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="detail-link"
              >
                View coaster on Coasterpedia
              </a>
            )}
          </div>
        )}

        {groupParent && aggregateStats && (
          <>
            <DetailSection title="On CoasterCred · All tracks">
              <dl className="detail-metrics">
                <Metric
                  label="Unique riders"
                  value={aggregateStats.uniqueRiderCount}
                />
                <Metric
                  label="Total logs"
                  value={aggregateStats.totalLogCount}
                />
                <Metric
                  label="My rides"
                  value={aggregateStats.totalRideCount}
                />
                <Metric
                  label="Tracks ridden"
                  value={`${aggregateStats.tracksRiddenCount}/${groupTrackEntries.length}`}
                />
              </dl>
            </DetailSection>
            <section className="detail-section" aria-label="Tracks">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h4 className="detail-section-title">Tracks</h4>
                <span className="detail-muted text-xs">
                  {aggregateStats.tracksRankedCount} ranked
                </span>
              </div>
              <p className="detail-muted mb-2 text-xs">
                Select a track for specifications, stats, and history.
              </p>
              <div>
                {groupTrackEntries.map((entry) => {
                  const key = getTrackKey(entry.coaster);
                  const isSelected = selectedTrackEntry
                    ? key === getTrackKey(selectedTrackEntry.coaster)
                    : false;
                  const trackLabel =
                    getCoasterTrackLabel(entry.coaster) ??
                    getCoasterDisplayName(entry.coaster);
                  return (
                    <div key={key} className="detail-track-row">
                      <button
                        type="button"
                        className="detail-track-select"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedTrackKey(key)}
                      >
                        <span
                          className="track-selection-mark"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <strong>
                            {getCoasterDisplayName(entry.coaster)}
                          </strong>
                          <span className="detail-track-meta">
                            {entry.myStats.rideCount}{" "}
                            {entry.myStats.rideCount === 1 ? "ride" : "rides"}
                            {typeof entry.myStats.currentRank === "number"
                              ? ` · Rank #${entry.myStats.currentRank}`
                              : " · Not ranked"}
                            {` · ${entry.appStats.totalLogCount} ${entry.appStats.totalLogCount === 1 ? "log" : "logs"}`}
                          </span>
                        </span>
                      </button>
                      {typeof entry.myStats.currentScore === "number" && (
                        <ScoreBadge
                          score={entry.myStats.currentScore}
                          size="sm"
                        />
                      )}
                      <button
                        type="button"
                        className="detail-track-log"
                        onClick={() => openLogModalForTrack(key)}
                        aria-label={`Log ${trackLabel}`}
                      >
                        <PlusIcon className="h-4 w-4" />
                        <span>Log</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {displayCoaster && (
          <>
            <DetailSection
              title={
                groupParent
                  ? `${getCoasterDisplayName(displayCoaster)} · Specifications`
                  : "Specifications"
              }
            >
              <CoasterSpecifications coaster={displayCoaster} />
            </DetailSection>
            <DetailSection
              title={
                groupParent ? "On CoasterCred · This track" : "On CoasterCred"
              }
            >
              <dl className="detail-metrics">
                <Metric
                  label="Unique riders"
                  value={profileData?.appStats?.uniqueRiderCount ?? 0}
                />
                <Metric
                  label="Total logs"
                  value={profileData?.appStats?.totalLogCount ?? 0}
                />
                <Metric
                  label="Followed riders"
                  value={friendSummary?.followedRiderCount ?? 0}
                />
                <Metric
                  label="Friends avg"
                  value={
                    typeof friendSummary?.averageFollowedScore === "number"
                      ? friendSummary.averageFollowedScore.toFixed(1)
                      : "—"
                  }
                />
              </dl>
            </DetailSection>
            <DetailSection
              title={groupParent ? "Your status · This track" : "Your status"}
            >
              <dl className="detail-metrics detail-metrics-pair">
                <Metric
                  label="Ride count"
                  value={profileData?.myStats?.rideCount ?? 0}
                />
                <Metric
                  label="Rank"
                  value={
                    typeof profileData?.myStats?.currentRank === "number"
                      ? `#${profileData.myStats.currentRank}`
                      : "—"
                  }
                />
              </dl>
            </DetailSection>

            <section className="detail-section detail-accordion">
              <button
                aria-expanded={isFriendsOpen}
                onClick={() => setIsFriendsOpen((current) => !current)}
                className="detail-disclosure"
              >
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    Friends who rode this
                  </h4>
                </div>
                <ExpandIcon isOpen={isFriendsOpen} />
              </button>

              {isFriendsOpen && (
                <div className="detail-accordion-body">
                  {followedRiders === undefined ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Loading followed riders...
                    </p>
                  ) : loadedFollowedRiders.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      None of the riders you follow have logged this yet.
                    </p>
                  ) : (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {loadedFollowedRiders.length} followed rider
                          {loadedFollowedRiders.length === 1 ? "" : "s"}
                        </p>
                        {loadedFollowedRiders.length > 5 && (
                          <button
                            onClick={() =>
                              setShowAllFollowedRiders((current) => !current)
                            }
                            className="text-xs font-medium text-primary transition-colors hover:text-primary-hover"
                          >
                            {showAllFollowedRiders
                              ? "Show less"
                              : `View all (${loadedFollowedRiders.length})`}
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col">
                        {visibleFollowedRiders.map((entry: any) => (
                          <div
                            key={entry.user._id}
                            className="detail-list-row flex items-center gap-3"
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
                                {entry.lastRideDate
                                  ? `Last ride ${formatDate(entry.lastRideDate)}`
                                  : "Ride date unavailable"}
                                {typeof entry.rank === "number"
                                  ? ` · #${entry.rank}`
                                  : ""}
                              </p>
                            </div>
                            {typeof entry.score === "number" ? (
                              <ScoreBadge score={entry.score} size="sm" />
                            ) : (
                              <span className="detail-muted text-xs">
                                {entry.rideCount} ride
                                {entry.rideCount === 1 ? "" : "s"}
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

            <section className="detail-section detail-accordion">
              <button
                aria-expanded={isRideHistoryOpen}
                onClick={() => setIsRideHistoryOpen((current) => !current)}
                className="detail-disclosure"
              >
                <div>
                  <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                    My ride history
                  </h4>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {profileData?.myStats?.rideCount ?? 0} total ride
                    {(profileData?.myStats?.rideCount ?? 0) === 1
                      ? ""
                      : "s"}{" "}
                    for this coaster
                  </p>
                </div>
                <ExpandIcon isOpen={isRideHistoryOpen} />
              </button>

              {isRideHistoryOpen && (
                <div className="detail-accordion-body">
                  {rideHistory === undefined ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Loading ride history...
                    </p>
                  ) : loadedRideHistory.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No rides logged yet.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-col">
                        {loadedRideHistory.map((log: any) => (
                          <div
                            key={log._id}
                            className="detail-list-row detail-history-row flex flex-wrap items-center gap-3"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-100">
                                {formatDate(log.rideDate)}
                              </p>
                              {log.notes && (
                                <p className="mt-0.5 break-words text-xs text-gray-500 dark:text-gray-400">
                                  {log.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                onClick={() => handleEditLog(log)}
                                disabled={saving}
                                className="text-xs font-medium text-primary transition-colors hover:text-primary-hover disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => void handleRemove(log._id)}
                                disabled={saving}
                                className="text-xs font-medium text-red-500 transition-colors hover:text-red-400 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {(profileData?.myStats?.rideCount ?? 0) >
                        loadedRideHistory.length && (
                        <button
                          onClick={() =>
                            setRideHistoryLimit((current) => current + 10)
                          }
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
          </>
        )}

        <p className="mt-2 text-[11px] leading-4 text-gray-400 dark:text-gray-500">
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
      {displayCoaster && isLogModalOpen && (
        <LogRideModal
          mode={isEditingLog ? "edit" : "create"}
          onClose={() => resetLogState(false)}
          title={logModalTitle}
          subtitle={logModalSubtitle}
          coasterName={getCoasterDisplayName(displayCoaster)}
          coasterPark={displayCoaster.park}
          rideDate={rideDate}
          notes={notes}
          saving={saving}
          loadingData={loadingData}
          loadingComparison={loadingComparison}
          hasCurrentRank={hasCurrentRank}
          currentRank={profileData?.myStats?.currentRank ?? null}
          currentScore={profileData?.myStats?.currentScore ?? null}
          comparisonTarget={comparisonTarget}
          shouldLoadComparisonList={shouldLoadComparisonList}
          rankedCoasterCount={rankedCoasters.length}
          onRideDateChange={setRideDate}
          onNotesChange={setNotes}
          onPrimaryAction={() =>
            void (isEditingLog ? saveEditedLog() : startComparisonFlow())
          }
          onComparisonChoice={(winner) => void handleComparisonChoice(winner)}
          onRerank={() => {
            setIsLogModalOpen(true);
            setIsRerankRequested(true);
            setShouldLoadComparisonList(true);
            if (rankedCoasters.length > 0) {
              setComparisonBounds({ low: 0, high: rankedCoasters.length });
            }
          }}
        />
      )}

      {selectedPark && (
        <ParkModal
          suspended={drilldownCoaster !== null}
          park={selectedPark.park}
          initialLocation={selectedPark.location}
          initialSourceUrl={selectedPark.sourceUrl}
          onClose={() => setSelectedPark(null)}
          onSelectCoaster={(selection) => setDrilldownCoaster(selection)}
        />
      )}

      {drilldownCoaster && (
        <CoasterModal
          coaster={drilldownCoaster.coaster}
          initialSelectedTrackKey={drilldownCoaster.initialSelectedTrackKey}
          onClose={() => setDrilldownCoaster(null)}
        />
      )}
    </>
  );
}

function LogActionButton({
  onClick,
  ariaLabel,
}: {
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="detail-log-action"
    >
      <PlusIcon className="h-4 w-4" />
      <span>Log</span>
    </button>
  );
}

function PlusIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 5V19M5 12H19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogRideModal({
  mode,
  onClose,
  title,
  subtitle,
  coasterName,
  coasterPark,
  rideDate,
  notes,
  saving,
  loadingData,
  loadingComparison,
  hasCurrentRank,
  currentRank,
  currentScore,
  comparisonTarget,
  shouldLoadComparisonList,
  rankedCoasterCount,
  onRideDateChange,
  onNotesChange,
  onPrimaryAction,
  onComparisonChoice,
  onRerank,
}: {
  mode: "create" | "edit";
  onClose: () => void;
  title: string;
  subtitle: string;
  coasterName: string;
  coasterPark?: string;
  rideDate: string;
  notes: string;
  saving: boolean;
  loadingData: boolean;
  loadingComparison: boolean;
  hasCurrentRank: boolean;
  currentRank: number | null | undefined;
  currentScore: number | null | undefined;
  comparisonTarget: {
    coaster?: Pick<CoasterSummary, "name" | "park"> | null;
  } | null;
  shouldLoadComparisonList: boolean;
  rankedCoasterCount: number;
  onRideDateChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onPrimaryAction: () => void;
  onComparisonChoice: (winner: "selected" | "other") => void;
  onRerank: () => void;
}) {
  const scrollRef = useScrollToTop([
    title,
    comparisonTarget?.coaster?.name ?? null,
  ]);

  return (
    <ModalContainer
      onClose={onClose}
      maxWidth="md"
      scrollRef={scrollRef}
      overlayClassName="z-[60]"
      label={title}
    >
      <div className="detail-header">
        <div className="min-w-0">
          <h4 className="detail-title">{title}</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      {mode === "create" && typeof currentRank === "number" && (
        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          Currently ranked #{currentRank}
          {typeof currentScore === "number"
            ? ` with a ${currentScore.toFixed(1)}`
            : ""}
          .
        </p>
      )}

      <div className="mb-3">
        <label
          htmlFor="log-ride-date"
          className="mb-1 block text-xs text-gray-500 dark:text-gray-400"
        >
          Ride date
        </label>
        <input
          id="log-ride-date"
          type="date"
          value={rideDate}
          max={todayDateInputValue()}
          onChange={(e) => onRideDateChange(e.target.value)}
          className="date-input-field"
        />
      </div>

      <label
        htmlFor="log-ride-notes"
        className="mb-1 block text-xs text-gray-500 dark:text-gray-400"
      >
        Notes (optional)
      </label>
      <textarea
        id="log-ride-notes"
        placeholder="Notes (optional)..."
        value={notes}
        maxLength={500}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={2}
        className="input-field mb-3 resize-none"
      />

      {mode === "edit" ? null : loadingData ? (
        <div className="detail-help">Loading your current rankings...</div>
      ) : loadingComparison ? (
        <div className="detail-help">
          Loading the ranking comparison list...
        </div>
      ) : comparisonTarget ? (
        <div className="detail-comparison">
          <p className="detail-section-title">Which ranks higher?</p>
          <p className="sr-only" role="status">
            Compare {coasterName} with{" "}
            {comparisonTarget.coaster?.name ?? "Unknown"}.
          </p>
          <div className="comparison-options">
            <button
              type="button"
              onClick={() => onComparisonChoice("selected")}
              disabled={saving}
              className="comparison-option"
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {coasterName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {coasterPark}
              </p>
            </button>
            <button
              type="button"
              onClick={() => onComparisonChoice("other")}
              disabled={saving}
              className="comparison-option"
            >
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {comparisonTarget.coaster?.name ?? "Unknown"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {comparisonTarget.coaster?.park}
              </p>
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Pick the coaster you’d place higher in your personal rankings.
          </p>
        </div>
      ) : (
        <div className="detail-help">
          {hasCurrentRank
            ? "Logging another ride adds it to your history. Use Re-rank if you want to move it in your list."
            : shouldLoadComparisonList && rankedCoasterCount === 0
              ? "This will become your first ranked coaster."
              : shouldLoadComparisonList
                ? "Working out where this coaster belongs in your list."
                : "Open the comparison flow to place this coaster into your list."}
        </div>
      )}

      <div className="detail-log-footer">
        {(!comparisonTarget || mode === "edit") && (
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={saving || (mode === "create" && loadingData)}
            className="min-h-11 flex-1 rounded bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
          >
            {mode === "edit"
              ? "Save Changes"
              : hasCurrentRank
                ? "Log Ride"
                : "Log and Rank Ride"}
          </button>
        )}
        {mode === "create" && hasCurrentRank && (
          <button
            type="button"
            onClick={onRerank}
            disabled={saving || loadingComparison}
            className="min-h-11 rounded border border-primary/30 px-4 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/5 dark:hover:bg-primary/10 disabled:opacity-50"
          >
            {comparisonTarget ? "Restart ranking" : "Re-rank"}
          </button>
        )}
      </div>
    </ModalContainer>
  );
}

function ExpandIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <ChevronDown
      aria-hidden="true"
      size={20}
      strokeWidth={1.6}
      className={`text-gray-500 dark:text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
    />
  );
}
