import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar } from "../components/Avatar";
import { formatDate } from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";
import { UserConnectionsModal } from "../components/UserConnectionsModal";

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

  if (profileData === undefined || rankingsData === undefined) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={onBack} className="text-sm text-primary font-medium mb-4">← Back</button>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={onBack} className="text-sm text-primary font-medium mb-4">← Back</button>
        <div className="bg-white rounded-2xl border shadow-sm p-8 text-center">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Profile not found</h2>
          <p className="text-sm text-gray-500">This rider may no longer exist.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={onBack} className="text-sm text-primary font-medium mb-4">← Back</button>

        <div className="bg-white rounded-2xl border shadow-sm p-5 mb-4">
          <div className="flex items-start gap-4">
            <Avatar
              avatarUrl={profileData.profile?.avatarUrl}
              name={profileData.user?.name}
              sizeClassName="w-16 h-16"
              textClassName="text-2xl"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{profileData.user?.name ?? "Unknown rider"}</h2>
              {profileData.profile?.homepark && (
                <p className="text-sm text-gray-500 mt-0.5">🏠 {profileData.profile.homepark}</p>
              )}
              {profileData.profile?.bio && (
                <p className="text-sm text-gray-600 mt-1">{profileData.profile.bio}</p>
              )}
            </div>
            {!profileData.isCurrentUser && (
              <button
                onClick={() => void handleFollowToggle()}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium shrink-0 ${
                  profileData.isFollowing ? "bg-gray-100 text-gray-600" : "bg-primary text-white"
                }`}
              >
                {profileData.isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-primary">{profileData.uniqueCoasterCount}</p>
              <p className="text-xs text-gray-500">Unique Coasters</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-primary truncate">{profileData.topCoaster?.name ?? "—"}</p>
              <p className="text-xs text-gray-500">Current #1</p>
            </div>
            <button
              onClick={() => setConnectionsKind("followers")}
              className="bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors"
            >
              <p className="text-2xl font-bold text-primary">{profileData.followerCount}</p>
              <p className="text-xs text-gray-500">Followers</p>
            </button>
            <button
              onClick={() => setConnectionsKind("following")}
              className="bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors"
            >
              <p className="text-2xl font-bold text-primary">{profileData.followingCount}</p>
              <p className="text-xs text-gray-500">Following</p>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">Recent Rides</h3>
            <span className="text-xs text-gray-400">Last 3</span>
          </div>
          {profileData.recentRides.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No rides logged yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {profileData.recentRides.map((log: any) => (
                <div key={log._id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                  <p className="text-sm font-semibold text-gray-900">{log.coaster?.name ?? "Unknown"}</p>
                  <p className="text-xs text-gray-500">{log.coaster?.park} · {formatDate(log.rideDate)}</p>
                  {log.notes && <p className="text-xs text-gray-500 mt-1">{log.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-800">Ranked Coasters</h3>
              <p className="text-xs text-gray-400">{rankingsData.totalCount} total</p>
            </div>
            <p className="text-xs text-gray-400">
              Page {Math.min(rankingsData.page + 1, rankingsData.pageCount)} of {rankingsData.pageCount}
            </p>
          </div>

          {rankingsData.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No rankings yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {rankingsData.items.map((item: any) => (
                <div key={item._id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                    {item.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.coaster?.name ?? "Unknown coaster"}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.coaster?.park} · {item.coaster?.location}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    item.coaster?.type === "Hybrid" ? "bg-purple-100 text-purple-700" :
                    item.coaster?.type === "Wood" ? "bg-amber-100 text-amber-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {item.coaster?.type}
                  </span>
                </div>
              ))}
            </div>
          )}

          {rankingsData.pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setRankingsPage((page) => Math.max(0, page - 1))}
                disabled={rankingsData.page === 0}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setRankingsPage((page) => Math.min(rankingsData.pageCount - 1, page + 1))
                }
                disabled={rankingsData.page >= rankingsData.pageCount - 1}
                className="px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 disabled:opacity-40"
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
    </>
  );
}
