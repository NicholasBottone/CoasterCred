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
import { ModalContainer } from "./ModalContainer";

export type CoasterSummary = {
  _id?: string;
  source?: string;
  sourceId?: string;
  sourceUrl?: string;
  lastSyncedAt?: number;
  name: string;
  park: string;
  location: string;
  type: string;
  manufacturer?: string;
  product?: string;
  propulsion?: string;
  durationSeconds?: number;
  status?: string;
  heightFt?: number;
  speedMph?: number;
  lengthFt?: number;
  inversions?: number;
  yearOpened?: number;
  imageUrl?: string;
};

export function CoasterModal({
  coaster,
  onClose,
}: {
  coaster: CoasterSummary;
  onClose: () => void;
}) {
  const scrollRef = useScrollToTop([coaster._id, coaster.sourceId, coaster.imageUrl]);
  const [localCoasterId, setLocalCoasterId] = useState<string | undefined>(coaster._id);
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

  const profileData = useQuery(api.coasters.getCoasterProfile, {
    coasterId: localCoasterId ? (localCoasterId as any) : undefined,
    source: coaster.source,
    sourceId: coaster.sourceId,
  });
  const friendSummary = useQuery(
    api.coasters.getCoasterFriendSummary,
    localCoasterId ? { coasterId: localCoasterId as any } : "skip",
  );
  const rideHistory = useQuery(
    api.rideLogs.getMyLogsForCoaster,
    localCoasterId && isRideHistoryOpen
      ? { coasterId: localCoasterId as any, limit: rideHistoryLimit }
      : "skip",
  );
  const followedRiders = useQuery(
    api.coasters.getCoasterFollowedRiders,
    localCoasterId && isFriendsOpen ? { coasterId: localCoasterId as any } : "skip",
  );
  const comparisonRankings = useQuery(
    api.rankings.getMyRankingComparisonList,
    shouldLoadComparisonList ? {} : "skip",
  );
  const saveRideWithRank = useMutation(api.rankings.saveRideWithRank);
  const removeLog = useMutation(api.rideLogs.removeLog);
  const materializeCoaster = useAction(api.coasters.materializeCoasterpediaCoaster);

  useEffect(() => {
    setLocalCoasterId(coaster._id);
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
  }, [coaster._id, coaster.sourceId, coaster.imageUrl]);

  useEffect(() => {
    const resolvedLocalId = profileData?.localCoaster?._id as string | undefined;
    if (resolvedLocalId && resolvedLocalId !== localCoasterId) {
      setLocalCoasterId(resolvedLocalId);
    }
  }, [localCoasterId, profileData?.localCoaster?._id]);

  const loadingData =
    profileData === undefined ||
    (localCoasterId !== undefined && profileData?.myStats === undefined);
  const loadingComparison = shouldLoadComparisonList && comparisonRankings === undefined;

  const displayCoaster = (profileData?.localCoaster as CoasterSummary | null) ?? coaster;
  const loadedRideHistory = rideHistory ?? [];
  const loadedFollowedRiders = followedRiders ?? [];
  const visibleFollowedRiders = showAllFollowedRiders ? loadedFollowedRiders : loadedFollowedRiders.slice(0, 5);

  const rankedCoasters = useMemo(
    () => (comparisonRankings ?? []).filter((item: any) => item.coasterId !== localCoasterId),
    [comparisonRankings, localCoasterId],
  );

  const hasCurrentRank = typeof profileData?.myStats?.currentRank === "number";
  const comparisonIndex =
    comparisonBounds === null
      ? null
      : Math.floor((comparisonBounds.low + comparisonBounds.high) / 2);
  const comparisonTarget =
    comparisonIndex === null ? null : rankedCoasters[comparisonIndex];

  const ensureLocalCoasterId = async () => {
    if (localCoasterId) return localCoasterId;
    if (coaster.source === "coasterpedia" && coaster.sourceId) {
      const nextId = (await materializeCoaster({ sourceId: coaster.sourceId })) as string;
      setLocalCoasterId(nextId);
      return nextId;
    }
    throw new Error("Could not create a local coaster record");
  };

  const saveRide = async (targetRank?: number) => {
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
    if (loadingData) return;

    setIsLogOpen(true);
    setShouldLoadComparisonList(true);

    if (typeof profileData?.myStats?.currentRank === "number") {
      await saveRide();
      return;
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

  return (
    <ModalContainer onClose={onClose} maxWidth="2xl" scrollRef={scrollRef}>
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">
                {displayCoaster.name}
              </h3>
              <span className={getCoasterTypeBadgeClasses(displayCoaster.type)}>{displayCoaster.type}</span>
              {displayCoaster.status && displayCoaster.status.toLowerCase() !== "operating" && (
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  {displayCoaster.status}
                </span>
              )}
              {typeof profileData?.myStats?.currentScore === "number" && (
                <ScoreBadge score={profileData.myStats.currentScore} size="sm" />
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {displayCoaster.park} · {displayCoaster.location}
            </p>
            {displayCoaster.sourceUrl && (
              <a
                href={displayCoaster.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-primary hover:underline"
              >
                View on Coasterpedia
              </a>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-xl leading-none text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ×
          </button>
        </div>

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
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">On CoasterCred</h4>
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
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Your status</h4>
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
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Log Ride</h4>
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
                  className="input-field"
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
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{displayCoaster.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{displayCoaster.park}</p>
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
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
