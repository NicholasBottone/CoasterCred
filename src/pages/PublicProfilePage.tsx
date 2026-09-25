import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar } from "../components/Avatar";
import { Home } from "lucide-react";
import { PageHeading } from "../components/TrackMotif";
import { ProfileSummary } from "../components/ProfileSummary";
import { RecentRides } from "../components/RecentRides";
import { getErrorMessage } from "../lib/errors";
import { UserConnectionsModal } from "../components/UserConnectionsModal";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterMaterialClasses } from "../lib/badges";
import { CoasterModal } from "../components/CoasterModal";
import { type CoasterSummary } from "../lib/coasterData";
import { ProfileWrappedStats } from "../components/ProfileWrappedStats";

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
  const [connectionsKind, setConnectionsKind] = useState<
    "followers" | "following" | null
  >(null);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(
    null,
  );
  const profileData = useQuery(apiAny.profiles.getPublicProfilePage, {
    userId,
  });
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
      <div className="page-content profile-page">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        >
          ← Back
        </button>
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="page-content profile-page">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        >
          ← Back
        </button>
        <div className="surface-card p-8 text-center">
          <h2 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100">
            Profile not found
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This rider may no longer exist.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-content profile-page">
        <button
          onClick={onBack}
          className="mb-4 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
        >
          ← Back
        </button>

        <PageHeading title="Rider profile" motif="airtime" eyebrow />
        <div className="profile-intro">
          <div className="flex items-start gap-4">
            <Avatar
              avatarUrl={
                profileData.profile?.avatarUrl ?? profileData.user?.image
              }
              name={profileData.user?.name}
              sizeClassName="w-16 h-16"
              textClassName="text-2xl"
            />
            <div className="flex-1 min-w-0">
              <h1>{profileData.user?.name ?? "Unknown rider"}</h1>
              {profileData.profile?.username && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  @{profileData.profile.username}
                </p>
              )}
              {profileData.profile?.homepark && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  <Home className="inline h-3.5 w-3.5" aria-hidden="true" />{" "}
                  {profileData.profile.homepark}
                </p>
              )}
              {profileData.profile?.bio && (
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  {profileData.profile.bio}
                </p>
              )}
            </div>
            {!profileData.isCurrentUser && (
              <button
                onClick={() => void handleFollowToggle()}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  profileData.isFollowing
                    ? "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                    : "bg-primary text-white hover:bg-primary-hover "
                }`}
              >
                {profileData.isFollowing ? "Following" : "Follow"}
              </button>
            )}
          </div>

          <div className="profile-connections">
            <button
              type="button"
              onClick={() => setConnectionsKind("followers")}
            >
              <strong>{profileData.followerCount}</strong>{" "}
              {profileData.followerCount === 1 ? "follower" : "followers"}
            </button>
            <button
              type="button"
              onClick={() => setConnectionsKind("following")}
            >
              <strong>{profileData.followingCount}</strong> following
            </button>
          </div>
        </div>
        <ProfileSummary
          count={profileData.uniqueCoasterCount}
          topName={profileData.topCoaster?.name}
        />
        <div className="profile-grid">
          <ProfileWrappedStats
            stats={profileData.wrappedStats}
            onSelectCoaster={openCoaster}
          />
          <RecentRides
            rides={profileData.recentRides}
            onSelectCoaster={openCoaster}
          />
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                Ranked Coasters
              </h3>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {rankingsData.totalCount} total
              </p>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Page {Math.min(rankingsData.page + 1, rankingsData.pageCount)} of{" "}
              {rankingsData.pageCount}
            </p>
          </div>

          {rankingsData.items.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">
              No rankings yet
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {rankingsData.items.map((item: any) => (
                <button
                  key={item._id}
                  onClick={() => openCoaster(item.coaster)}
                  className="flat-row flex w-full items-center gap-3 text-left"
                >
                  <div className="rank-number shrink-0 text-sm">
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
                  <span
                    className={getCoasterMaterialClasses(item.coaster?.type)}
                  >
                    {item.coaster?.type}
                  </span>
                  {typeof item.score === "number" && (
                    <ScoreBadge score={item.score} size="sm" />
                  )}
                </button>
              ))}
            </div>
          )}

          {rankingsData.pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                onClick={() => setRankingsPage((page) => Math.max(0, page - 1))}
                disabled={rankingsData.page === 0}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                onClick={() =>
                  setRankingsPage((page) =>
                    Math.min(rankingsData.pageCount - 1, page + 1),
                  )
                }
                disabled={rankingsData.page >= rankingsData.pageCount - 1}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-40"
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
