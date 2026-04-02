import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Avatar } from "../components/Avatar";
import { formatDateTime, formatDistanceToNow } from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";

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
  const syncCoaster = useAction(api.admin.syncCoaster);
  const [syncingCoasterId, setSyncingCoasterId] = useState<string | null>(null);

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

  if (adminAccess === undefined || (adminAccess.isAdmin && dashboard === undefined)) {
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
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Admin access required</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Set your user document&apos;s <code>role</code> field to <code>admin</code> to unlock this dashboard.
          </p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const maxSignupCount = Math.max(...dashboard.signupSeries.map((entry) => entry.count), 1);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4">
      <div className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Synced Coasters" value={dashboard.summary.syncedCoasterCount} />
        <SummaryCard
          label={`Older Than ${dashboard.staleThresholdDays} Days`}
          value={dashboard.summary.staleCoasterCount}
        />
        <SummaryCard label="Signed-Up Users" value={dashboard.summary.userCount} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.25fr,0.95fr]">
        <section className="surface-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Stale coaster syncs</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Coasterpedia-backed entries that have never been synced or have gone stale.
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
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
                          {coaster.lastSyncedAt
                            ? formatDistanceToNow(coaster.lastSyncedAt)
                            : "Never synced"}
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
        </section>

        <section className="surface-card p-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">User signups</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Daily signup volume and the full list of users currently in the app.
          </p>

          <div className="mt-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
            <div className="flex items-end gap-2 overflow-x-auto pb-2">
              {dashboard.signupSeries.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No users yet.</p>
              ) : (
                dashboard.signupSeries.map((entry) => (
                  <div key={entry.date} className="flex min-w-12 flex-col items-center gap-2">
                    <div className="flex h-32 items-end">
                      <div
                        className="w-8 rounded-t-xl bg-primary/80"
                        style={{ height: `${Math.max((entry.count / maxSignupCount) * 100, 10)}%` }}
                        title={`${entry.label}: ${entry.count} signup${entry.count === 1 ? "" : "s"}`}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">{entry.count}</p>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">{entry.label}</p>
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
                    Joined {formatDateTime(user.createdAt)} · {user.rideCount} rides · {user.rankingCount} ranked
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
