import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar } from "../components/Avatar";
import { formatDate } from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";
import { UserConnectionsModal } from "../components/UserConnectionsModal";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterTypeBadgeClasses } from "../lib/badges";
import { CoasterModal, type CoasterSummary } from "../components/CoasterModal";

const apiAny = api as any;
const RANKINGS_PAGE_SIZE = 25;

export function PublicProfilePage({
  userId,
  onBack,
  onViewProfile,
}: {
  userId: string;
  onBack: () => void;
  onViewProfile: (userId: string) => void;
}) {
  const [rankingsPage, setRankingsPage] = useState(0);
  const [connectionsKind, setConnectionsKind] = useState<"followers" | "following" | null>(null);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(null);
  const profileData = useQuery(apiAny.profiles.getPublicProfilePage, { userId });
  const rankingsData = useQuery(apiAny.rankings.getUserRankingsPage, {
    userId,
    page: rankingsPage,
    limit: RANKINGS_PAGE_SIZE,
  });
  const follow = useMutation(api.profiles.follow);
  const unfollow = useMutation(api.profiles.unfollow);

  useEffect(() => {
    setRankingsPage(0);
    setConnectionsKind(null);
  }, [userId]);

  const handleFollowToggle = async () => {
    if (!profileData || profileData.isCurrentUser) return;
    try {
      if (profileData.isFollowing) {
        await unfollow({ targetUserId: userId as any });
        toast.success("Unfollowed");
      } else {
        await follow({ targetUserId: userId as any });
        toast.success("Following!");
      }
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not update follow status"));
    }
  };

  const openProfileFromConnections = (nextUserId: string) => {
    setConnectionsKind(null);
    setRankingsPage(0);
    onViewProfile(nextUserId);
  };

  const openCoaster = (coaster: any) => {
    if (!coaster) return;
    setSelectedCoaster(coaster as CoasterSummary);
  };

  if (profileData === undefined || rankingsData === undefined) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={onBack} className="mb-4 text-sm font-medium text-primary transition-colors hover:text-primary-hover">← Back</button>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={onBack} className="mb-4 text-sm font-medium text-primary transition-colors hover:text-primary-hover">← Back</button>
        <div className="surface-card p-8 text-center">
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">Profile not found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">This rider may no longer exist.</p>
        </div>
      </div>
    );
  }

  return (
      <>
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={onBack} className="mb-4 text-sm font-medium text-primary transition-colors hover:text-primary-hover">← Back</button>

        <div className="surface-card p-5 mb-4">
          <div className="flex items-start gap-4">
            <Avatar
              avatarUrl={profileData.profile?.avatarUrl}
              name={profileData.user?.name}
              sizeClassName="w-16 h-16"
              textClassName="text-2xl"
            />
            <div className="flex-1 min-w-0">
              <h2 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{profileData.user?.name ?? "Unknown rider"}</h2>
              {profileData.profile?.homepark && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">🏠 {profileData.profile.homepark}</p>
              )}
              {profileData.profile?.bio && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{profileData.profile.bio}</p>
              )}
            </div>
            {!profileData.isCurrentUser && (
              <button
                onClick={() => void handleFollowToggle()}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:-translate-y-0.5 ${
                  profileData.isFollowing
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    : "bg-primary text-white hover:bg-primary-hover hover:shadow-md"
                }`}
              >
                {profileData.isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="surface-subtle p-3 text-center">
              <p className="text-2xl font-bold text-primary">{profileData.uniqueCoasterCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Unique Coasters</p>
            </div>
            <div className="surface-subtle p-3 text-center">
              <p className="text-lg font-bold text-primary truncate">{profileData.topCoaster?.name ?? "—"}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current #1</p>
            </div>
            <button
              onClick={() => setConnectionsKind("followers")}
              className="surface-subtle interactive-lift p-3 text-center"
            >
              <p className="text-2xl font-bold text-primary">{profileData.followerCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Followers</p>
            </button>
            <button
              onClick={() => setConnectionsKind("following")}
              className="surface-subtle interactive-lift p-3 text-center"
            >
              <p className="text-2xl font-bold text-primary">{profileData.followingCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Following</p>
            </button>
          </div>
        </div>

        <div className="surface-card p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 dark:text-gray-100">Recent Rides</h3>
            <span className="text-xs text-gray-400 dark:text-gray-500">Last 3</span>
          </div>
          {profileData.recentRides.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No rides logged yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profileData.recentRides.map((log: any) => (
                <button
                  key={log._id}
                  onClick={() => openCoaster(log.coaster)}
                  className="surface-subtle interactive-lift px-3 py-3 text-left"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{log.coaster?.name ?? "Unknown"}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{log.coaster?.park} · {formatDate(log.rideDate)}</p>
                  {log.notes && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{log.notes}</p>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="surface-card p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">Ranked Coasters</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">{rankingsData.totalCount} total</p>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Page {Math.min(rankingsData.page + 1, rankingsData.pageCount)} of {rankingsData.pageCount}
            </p>
          </div>

          {rankingsData.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">No rankings yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rankingsData.items.map((item: any) => (
                <button
                  key={item._id}
                  onClick={() => openCoaster(item.coaster)}
                  className="surface-subtle interactive-lift flex w-full items-center gap-3 px-3 py-3 text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {item.coaster?.name ?? "Unknown coaster"}
                    </p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                      {item.coaster?.park} · {item.coaster?.location}
                    </p>
                  </div>
                  <span className={getCoasterTypeBadgeClasses(item.coaster?.type)}>
                    {item.coaster?.type}
                  </span>
                  {typeof item.score === "number" && <ScoreBadge score={item.score} size="sm" />}
                </button>
              ))}
            </div>
          )}

          {rankingsData.pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setRankingsPage((page) => Math.max(0, page - 1))}
                disabled={rankingsData.page === 0}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-all hover:-translate-y-0.5 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setRankingsPage((page) => Math.min(rankingsData.pageCount - 1, page + 1))
                }
                disabled={rankingsData.page >= rankingsData.pageCount - 1}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-all hover:-translate-y-0.5 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {connectionsKind && (
        <UserConnectionsModal
          userId={userId}
          kind={connectionsKind}
          onClose={() => setConnectionsKind(null)}
          onSelectUser={openProfileFromConnections}
        />
      )}
      {selectedCoaster && (
        <CoasterModal
          coaster={selectedCoaster}
          onClose={() => setSelectedCoaster(null)}
        />
      )}
    </>
  );
}
