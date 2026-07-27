import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Avatar } from "../components/Avatar";
import { formatDateTime, formatDistanceToNow } from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";
import { getCoasterTypeBadgeClasses } from "../lib/badges";

export function AdminPage({
  onViewPublicProfile,
}: {
  onViewPublicProfile: (userId: string) => void;
}) {
  const adminAccess = useQuery(api.admin.getViewerAccess);
  const dashboard = useQuery(
    api.admin.getDashboard,
    adminAccess?.isAdmin ? {} : "skip",
  );
  const countryBackfillStatus = useQuery(
    api.admin.getCountryBackfillStatus,
    adminAccess?.isAdmin ? {} : "skip",
  );
  const multiTrackMigrationStatus = useQuery(
    api.admin.getMultiTrackMigrationStatus,
    adminAccess?.isAdmin ? {} : "skip",
  );
  const syncCoaster = useAction(api.admin.syncCoaster);
  const linkAndSyncCoaster = useAction(api.admin.linkAndSyncCoaster);
  const migrateMultiTrackCoasters = useAction(
    api.admin.migrateMultiTrackCoasters,
  );
  const backfillCoasterCountries = useAction(
    api.admin.backfillCoasterCountries,
  );
  const searchCoasterpedia = useAction(api.coasters.searchCoasterpedia);
  const [syncingCoasterId, setSyncingCoasterId] = useState<string | null>(null);
  const [matchingCoasterId, setMatchingCoasterId] = useState<string | null>(
    null,
  );
  const [matchQuery, setMatchQuery] = useState("");
  const [matchResults, setMatchResults] = useState<any[]>([]);
  const [searchingMatches, setSearchingMatches] = useState(false);
  const [linkingCoasterId, setLinkingCoasterId] = useState<string | null>(null);
  const [syncSearchQuery, setSyncSearchQuery] = useState("");
  const [isMigratingMultiTrack, setIsMigratingMultiTrack] = useState(false);
  const [isBackfillingCountries, setIsBackfillingCountries] = useState(false);

  const handleSync = async (coasterId: string) => {
    setSyncingCoasterId(coasterId);
    try {
      const result = await syncCoaster({ coasterId: coasterId as any });
      toast.success(`Synced ${result.name}`);
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not sync coaster"));
    } finally {
      setSyncingCoasterId(null);
    }
  };

  const openMatcher = (coaster: {
    _id: string;
    name: string;
    park: string;
  }) => {
    setMatchingCoasterId(coaster._id);
    setMatchQuery(`${coaster.name} ${coaster.park}`.trim());
    setMatchResults([]);
  };

  const runMatchSearch = async () => {
    const queryText = matchQuery.trim();
    if (!queryText) {
      setMatchResults([]);
      return;
    }

    setSearchingMatches(true);
    try {
      const results = await searchCoasterpedia({ q: queryText });
      setMatchResults(
        (results as any[]).flatMap((result) =>
          result.kind === "multiTrackGroup" ? result.tracks : [result],
        ),
      );
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not search Coasterpedia"));
    } finally {
      setSearchingMatches(false);
    }
  };

  const handleMultiTrackMigration = async () => {
    setIsMigratingMultiTrack(true);
    try {
      const result = await migrateMultiTrackCoasters({});
      if (result.scanned === 0) {
        toast.success("Multi-track migration is already complete");
      } else {
        toast.success(
          `Migrated ${result.migratedCoasterCount} coaster${result.migratedCoasterCount === 1 ? "" : "s"} · Checked ${result.checkedSingleTrackCount} single-track${result.failed > 0 ? ` · ${result.failed} failed` : ""}`,
        );
      }
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not migrate legacy multi-track coasters"),
      );
    } finally {
      setIsMigratingMultiTrack(false);
    }
  };

  const handleLinkAndSync = async (coasterId: string, sourceId: string) => {
    setLinkingCoasterId(coasterId);
    try {
      const result = await linkAndSyncCoaster({
        coasterId: coasterId as any,
        sourceId,
      });
      toast.success(`Linked and synced ${result.name}`);
      setMatchingCoasterId(null);
      setMatchQuery("");
      setMatchResults([]);
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not link this coaster to Coasterpedia"),
      );
    } finally {
      setLinkingCoasterId(null);
    }
  };

  const handleCountryBackfill = async () => {
    setIsBackfillingCountries(true);
    try {
      const result = await backfillCoasterCountries({});
      if (result.scanned === 0) {
        toast.success("Country backfill is already complete");
      } else {
        toast.success(
          `Backfilled ${result.updated} coaster countr${result.updated === 1 ? "y" : "ies"}${result.failed > 0 ? ` · ${result.failed} failed` : ""}`,
        );
      }
    } catch (error) {
      toast.error(
        getErrorMessage(error, "Could not backfill coaster countries"),
      );
    } finally {
      setIsBackfillingCountries(false);
    }
  };

  if (
    adminAccess === undefined ||
    (adminAccess.isAdmin &&
      (dashboard === undefined ||
        countryBackfillStatus === undefined ||
        multiTrackMigrationStatus === undefined))
  ) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (!adminAccess?.isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="surface-card p-5 text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Admin access required
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Set your user document&apos;s <code>role</code> field to{" "}
            <code>admin</code> to unlock this dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const maxSignupCount = Math.max(
    ...dashboard.signupSeries.map((entry) => entry.count),
    1,
  );
  const normalizedSyncSearchQuery = syncSearchQuery.trim().toLowerCase();
  const filteredSyncableCoasters = dashboard.syncableCoasters.filter(
    (coaster) => {
      if (!normalizedSyncSearchQuery) return true;
      return [coaster.name, coaster.park, coaster.location]
        .filter(Boolean)
        .some((value) =>
          value.toLowerCase().includes(normalizedSyncSearchQuery),
        );
    },
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard
          label="Synced Coasters"
          value={dashboard.summary.syncedCoasterCount}
        />
        <SummaryCard
          label={`Older Than ${dashboard.staleThresholdDays} Days`}
          value={dashboard.summary.staleCoasterCount}
        />
        <SummaryCard
          label="Signed-Up Users"
          value={dashboard.summary.userCount}
        />
      </div>

      <section className="surface-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Country backfill
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Fill the new normalized country field for Coasterpedia-backed
              coasters so country milestones can fire accurately.
            </p>
          </div>
          <button
            onClick={() => void handleCountryBackfill()}
            disabled={
              isBackfillingCountries ||
              (countryBackfillStatus?.sourceBackedMissingCountryCount ?? 0) ===
                0
            }
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBackfillingCountries
              ? "Backfilling..."
              : "Run country backfill batch"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MiniStatCard
            label="Source-backed"
            value={countryBackfillStatus?.sourceBackedCoasterCount ?? 0}
          />
          <MiniStatCard
            label="With country"
            value={countryBackfillStatus?.sourceBackedWithCountryCount ?? 0}
          />
          <MiniStatCard
            label="Still missing"
            value={countryBackfillStatus?.sourceBackedMissingCountryCount ?? 0}
          />
          <MiniStatCard
            label="Manual missing"
            value={countryBackfillStatus?.manualMissingCountryCount ?? 0}
          />
        </div>

        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Each run processes up to {countryBackfillStatus?.batchSize ?? 0}{" "}
          missing Coasterpedia-linked coasters. Manual/local-only coasters are
          left unchanged.
        </p>

        {countryBackfillStatus &&
        countryBackfillStatus.nextTargets.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {countryBackfillStatus.nextTargets.map((target) => (
              <span
                key={target.coasterId}
                className="rounded-full bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/25"
              >
                {target.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25">
            All source-backed coasters currently have normalized country data.
          </div>
        )}
      </section>

      <section className="surface-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              Multi-track migration
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Split legacy combined Coasterpedia multi-track coasters into
              separate track credits and move old logs to the first listed
              track.
            </p>
          </div>
          <button
            onClick={() => void handleMultiTrackMigration()}
            disabled={
              isMigratingMultiTrack ||
              (multiTrackMigrationStatus?.pendingCandidateCount ?? 0) === 0
            }
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isMigratingMultiTrack
              ? "Migrating..."
              : "Run multi-track migration batch"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MiniStatCard
            label="Legacy entries"
            value={multiTrackMigrationStatus?.legacyCandidateCount ?? 0}
          />
          <MiniStatCard
            label="Pending review"
            value={multiTrackMigrationStatus?.pendingCandidateCount ?? 0}
          />
          <MiniStatCard
            label="Kept single-track"
            value={multiTrackMigrationStatus?.checkedSingleTrackCount ?? 0}
          />
        </div>

        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Each run reviews up to {multiTrackMigrationStatus?.batchSize ?? 0}{" "}
          legacy Coasterpedia entries. Entries that remain single-track are
          marked as checked; only source entries that now expose multiple tracks
          are split.
        </p>

        {multiTrackMigrationStatus &&
        multiTrackMigrationStatus.nextTargets.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {multiTrackMigrationStatus.nextTargets.map((target) => (
              <span
                key={target.coasterId}
                className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-200 dark:ring-violet-500/25"
              >
                {target.name}
              </span>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25">
            All legacy Coasterpedia entries have been reviewed for multi-track
            migration.
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
        <section className="surface-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Stale coaster syncs
              </h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Coasterpedia-backed entries that have never been synced or have
                gone stale.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {dashboard.staleCoasters.length === 0 ? (
              <div className="surface-subtle rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
                Everything looks current right now.
              </div>
            ) : (
              dashboard.staleCoasters.map((coaster) => {
                const isSyncing = syncingCoasterId === coaster._id;
                const isMatching = matchingCoasterId === coaster._id;
                const isLinking = linkingCoasterId === coaster._id;
                return (
                  <div
                    key={coaster._id}
                    className="surface-subtle flex flex-col gap-3 rounded-2xl p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {coaster.name}
                          </h3>
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                            {coaster.lastSyncedAt
                              ? formatDistanceToNow(coaster.lastSyncedAt)
                              : "Never synced"}
                          </span>
                          {!coaster.canSync && (
                            <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-300">
                              Needs Coasterpedia match
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {coaster.park} · {coaster.location}
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Last synced: {formatDateTime(coaster.lastSyncedAt)}
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Source: {coaster.source ?? "local"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {coaster.sourceUrl && (
                          <a
                            href={coaster.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            View source
                          </a>
                        )}
                        {coaster.canSync ? (
                          <button
                            onClick={() => handleSync(coaster._id)}
                            disabled={isSyncing}
                            className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isSyncing ? "Syncing..." : "Sync now"}
                          </button>
                        ) : (
                          <button
                            onClick={() => openMatcher(coaster)}
                            className="rounded-xl border border-primary/30 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 dark:hover:bg-primary/10"
                          >
                            Match on Coasterpedia
                          </button>
                        )}
                      </div>
                    </div>

                    {isMatching && (
                      <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-4 dark:border-sky-900 dark:bg-sky-950/30">
                        <div className="flex flex-col gap-3 md:flex-row">
                          <input
                            type="text"
                            value={matchQuery}
                            onChange={(event) =>
                              setMatchQuery(event.target.value)
                            }
                            placeholder="Search Coasterpedia"
                            className="input-field flex-1"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={runMatchSearch}
                              disabled={searchingMatches}
                              className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {searchingMatches ? "Searching..." : "Search"}
                            </button>
                            <button
                              onClick={() => {
                                setMatchingCoasterId(null);
                                setMatchResults([]);
                              }}
                              className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                            >
                              Close
                            </button>
                          </div>
                        </div>

                        <p className="mt-3 text-xs text-sky-800 dark:text-sky-200">
                          Choose the matching Coasterpedia coaster. This keeps
                          the existing CoasterCred coaster ID, but replaces its
                          catalog fields and records that it is now synced from
                          Coasterpedia.
                        </p>

                        <div className="mt-3 flex flex-col gap-2">
                          {matchResults.map((result) => (
                            <div
                              key={result.sourceId}
                              className="flex flex-col gap-3 rounded-xl border border-sky-200 bg-white p-3 dark:border-sky-900 dark:bg-gray-950/40 md:flex-row md:items-center md:justify-between"
                            >
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                                    {result.name}
                                  </p>
                                  <span
                                    className={getCoasterTypeBadgeClasses(
                                      result.type,
                                    )}
                                  >
                                    {result.type}
                                  </span>
                                  {result._id && (
                                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                      Already linked elsewhere
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {result.park} · {result.location}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {result.sourceUrl && (
                                  <a
                                    href={result.sourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                                  >
                                    View source
                                  </a>
                                )}
                                <button
                                  onClick={() =>
                                    handleLinkAndSync(
                                      coaster._id,
                                      result.sourceId,
                                    )
                                  }
                                  disabled={isLinking || !!result._id}
                                  className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isLinking ? "Linking..." : "Use this match"}
                                </button>
                              </div>
                            </div>
                          ))}
                          {!searchingMatches && matchResults.length === 0 && (
                            <div className="rounded-xl border border-dashed border-sky-200 px-3 py-4 text-sm text-sky-800 dark:border-sky-900 dark:text-sky-200">
                              Search Coasterpedia to find a matching source for
                              this coaster.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-6 dark:border-gray-800">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Sync on demand
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Re-sync any coaster already linked to Coasterpedia, even if it
                  is not stale yet.
                </p>
              </div>

              <div className="w-full md:max-w-sm">
                <input
                  type="text"
                  value={syncSearchQuery}
                  onChange={(event) => setSyncSearchQuery(event.target.value)}
                  placeholder="Search linked coasters"
                  className="input-field"
                />
              </div>
            </div>

            <div className="mt-4 flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
              {filteredSyncableCoasters.length === 0 ? (
                <div className="surface-subtle rounded-xl p-4 text-sm text-gray-500 dark:text-gray-400">
                  {dashboard.syncableCoasters.length === 0
                    ? "No coasters are linked to Coasterpedia yet."
                    : "No linked coasters match that search."}
                </div>
              ) : (
                filteredSyncableCoasters.map((coaster) => {
                  const isSyncing = syncingCoasterId === coaster._id;
                  return (
                    <div
                      key={coaster._id}
                      className="surface-subtle flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                            {coaster.name}
                          </h3>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                            Linked to Coasterpedia
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          {coaster.park} · {coaster.location}
                        </p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Last synced: {formatDateTime(coaster.lastSyncedAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {coaster.sourceUrl && (
                          <a
                            href={coaster.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            View source
                          </a>
                        )}
                        <button
                          onClick={() => handleSync(coaster._id)}
                          disabled={isSyncing}
                          className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSyncing ? "Syncing..." : "Sync now"}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        <section className="surface-card p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            User signups
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Daily signup volume and the full list of users currently in the app.
          </p>

          <div className="mt-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {dashboard.signupSeries.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No users yet.
                </p>
              ) : (
                dashboard.signupSeries.map((entry) => (
                  <div
                    key={entry.date}
                    className="flex min-w-12 flex-col items-center gap-2"
                  >
                    <div className="flex h-32 items-end">
                      <div
                        className="w-8 rounded-t-xl bg-primary/80"
                        style={{
                          height: `${Math.max((entry.count / maxSignupCount) * 100, 10)}%`,
                        }}
                        title={`${entry.label}: ${entry.count} signup${entry.count === 1 ? "" : "s"}`}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {entry.count}
                      </p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        {entry.label}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-4 flex max-h-[32rem] flex-col gap-2 overflow-y-auto pr-1">
            {dashboard.users.map((user) => (
              <button
                key={user._id}
                onClick={() => onViewPublicProfile(user._id)}
                className="surface-subtle flex items-center gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <Avatar
                  avatarUrl={user.image ?? undefined}
                  name={user.name}
                  sizeClassName="h-11 w-11"
                  textClassName="text-base"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {user.name}
                    </p>
                    <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {user.authProvider}
                    </span>
                  </div>
                  <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                    {user.username ? `@${user.username}` : "No username"}{" "}
                    {user.homepark ? `· ${user.homepark}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    Joined {formatDateTime(user.createdAt)} · {user.rideCount}{" "}
                    rides · {user.rankingCount} ranked
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card p-4">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
    </div>
  );
}

function MiniStatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-gray-200 px-4 py-3 dark:border-gray-800">
      <p className="text-xs font-medium uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  );
}
