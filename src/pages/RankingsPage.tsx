import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDistanceToNow } from "../lib/dateUtils";
import { Avatar } from "../components/Avatar";
import { UserProfileModal } from "../components/UserProfileModal";

const WINDOW_OPTIONS = [
  { value: "30d", label: "30d", description: "Most coaster credits in the last 30 days" },
  { value: "365d", label: "365d", description: "Most coaster credits in the last 365 days" },
  { value: "all", label: "All-time", description: "Most coaster credits across all logged rides" },
] as const;

type LeaderboardWindow = (typeof WINDOW_OPTIONS)[number]["value"];

export function RankingsPage({
  onViewPublicProfile,
}: {
  onViewPublicProfile: (userId: string) => void;
}) {
  const [window, setWindow] = useState<LeaderboardWindow>("365d");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const leaderboard = useQuery(api.rankings.getFriendLeaderboard, { window });
  const selectedWindow = WINDOW_OPTIONS.find((option) => option.value === window) ?? WINDOW_OPTIONS[0];

  if (leaderboard === undefined) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No rankings yet</h2>
        <p className="text-gray-500 text-sm">
          Follow some friends and start logging rides to see who has been riding the most lately.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="ui-copy-disabled text-lg font-bold text-gray-800 dark:text-gray-100">Rankings</h2>
            <p className="ui-copy-disabled text-xs text-gray-400 dark:text-gray-500">{selectedWindow.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={window}
              onChange={(e) => setWindow(e.target.value as LeaderboardWindow)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            >
              {WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="ui-copy-disabled text-sm text-gray-400 dark:text-gray-500">{leaderboard.length} riders</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {leaderboard.map((entry: any, idx: number) => (
            <div
              key={entry.userId}
              className={`rounded-xl border shadow-sm p-4 flex items-center gap-3 interactive-lift ${
                entry.isCurrentUser
                  ? "bg-primary/5 border-primary/20 dark:bg-primary/10 dark:border-primary/30"
                  : "surface-card"
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {idx + 1}
              </div>
              <button
                onClick={() => setSelectedUserId(entry.userId)}
                className="flex flex-1 min-w-0 items-center gap-3 text-left"
              >
                <Avatar
                  avatarUrl={entry.profile?.avatarUrl}
                  name={entry.user?.name}
                  sizeClassName="w-10 h-10"
                  textClassName="text-base"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {entry.user?.name ?? "Unknown rider"}
                    </p>
                    {entry.isCurrentUser && (
                      <span className="text-[10px] uppercase tracking-wide bg-primary text-white px-2 py-0.5 rounded-full">
                        You
                      </span>
                    )}
                  </div>
                  {entry.profile?.homepark && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      Home park: {entry.profile.homepark}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {entry.lastRideAt
                      ? `Last ride ${formatDistanceToNow(entry.lastRideAt)}`
                      : "No rides logged yet"}
                  </p>
                </div>
              </button>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-primary">{entry.rideCount}</p>
                <p className="text-[11px] text-gray-500">{selectedWindow.label}</p>
                <p className="text-[11px] text-gray-400">{entry.totalRideCount} total</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onViewProfile={(userId) => {
            setSelectedUserId(null);
            onViewPublicProfile(userId);
          }}
        />
      )}
    </>
  );
}
