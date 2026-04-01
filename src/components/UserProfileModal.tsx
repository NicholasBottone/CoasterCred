import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import { getErrorMessage } from "../lib/errors";

const apiAny = api as any;

export function UserProfileModal({
  userId,
  onClose,
  onViewProfile,
}: {
  userId: string;
  onClose: () => void;
  onViewProfile: (userId: string) => void;
}) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const profileData = useQuery(apiAny.profiles.getPublicProfilePreview, { userId });
  const follow = useMutation(api.profiles.follow);
  const unfollow = useMutation(api.profiles.unfollow);

  const loading = profileData === undefined;

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [userId]);

  const handleFollowToggle = async () => {
    try {
      if (profileData?.isFollowing) {
        await unfollow({ targetUserId: userId as any });
        toast.success("Unfollowed");
      } else {
        await follow({ targetUserId: userId as any });
        toast.success("Following!");
      }
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not update follow status"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4"
      onClick={onClose}
    >
      <div
        ref={scrollContainerRef}
        className="surface-card w-full max-w-md max-h-[90vh] overflow-y-auto p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Profile</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {profileData?.isCurrentUser ? "Your public profile preview" : "Public profile preview"}
            </p>
          </div>
          <button onClick={onClose} className="text-xl leading-none text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300">×</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !profileData ? (
          <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">Profile not found</p>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-4">
              <Avatar
                avatarUrl={profileData?.profile?.avatarUrl}
                name={profileData?.user?.name}
                sizeClassName="w-16 h-16"
                textClassName="text-2xl"
              />
              <div className="flex-1 min-w-0">
                <h4 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">
                  {profileData?.user?.name ?? "Unknown rider"}
                </h4>
                {profileData?.profile?.homepark && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">🏠 {profileData.profile.homepark}</p>
                )}
                {profileData?.profile?.bio && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{profileData.profile.bio}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="surface-subtle interactive-lift p-3 text-center"
              >
                <p className="text-2xl font-bold text-primary">{profileData.uniqueCoasterCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Unique Coasters</p>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="surface-subtle interactive-lift p-3 text-center"
              >
                <p className="text-lg font-bold text-primary truncate">{profileData.topCoaster?.name ?? "—"}</p>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current #1</p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="surface-subtle interactive-lift p-3 text-center"
              >
                <p className="text-2xl font-bold text-primary">{profileData.followerCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Followers</p>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="surface-subtle interactive-lift p-3 text-center"
              >
                <p className="text-2xl font-bold text-primary">{profileData.followingCount}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Following</p>
              </button>
            </div>

            {!profileData.isCurrentUser && (
              <button
                onClick={() => void handleFollowToggle()}
                className={`mb-3 w-full rounded-xl py-2.5 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
                  profileData.isFollowing
                    ? "border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-500/30 dark:hover:bg-red-500/10"
                    : "bg-primary text-white hover:bg-primary-hover hover:shadow-md"
                }`}
              >
                {profileData.isFollowing ? "Unfollow" : "Follow"}
              </button>
            )}

            <button
              onClick={() => {
                onClose();
                onViewProfile(userId);
              }}
              className="w-full rounded-xl border border-primary/30 py-2.5 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/5 dark:hover:bg-primary/10"
            >
              View Full Profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}
