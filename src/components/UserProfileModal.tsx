import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import { getErrorMessage } from "../lib/errors";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { ModalCloseButton, ModalContainer } from "./ModalContainer";

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
  const scrollRef = useScrollToTop([userId]);
  const profileData = useQuery(apiAny.profiles.getPublicProfilePreview, { userId });
  const follow = useMutation(api.profiles.follow);
  const unfollow = useMutation(api.profiles.unfollow);

  const loading = profileData === undefined;

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
    <ModalContainer onClose={onClose} maxWidth="md" scrollRef={scrollRef}>
        {loading ? (
          <>
            <div className="mb-4 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </>
        ) : !profileData ? (
          <>
            <div className="mb-4 flex justify-end">
              <ModalCloseButton onClose={onClose} />
            </div>
            <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">Profile not found</p>
          </>
        ) : (
          <>
            <div className="mb-4 flex items-start gap-4">
              <Avatar
                avatarUrl={profileData?.profile?.avatarUrl ?? profileData?.user?.image}
                name={profileData?.user?.name}
                sizeClassName="w-16 h-16"
                textClassName="text-2xl"
              />
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">
                  {profileData?.user?.name ?? "Unknown rider"}
                </h4>
                {profileData?.profile?.username && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">@{profileData.profile.username}</p>
                )}
                {profileData?.profile?.homepark && (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">🏠 {profileData.profile.homepark}</p>
                )}
                {profileData?.profile?.bio && (
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{profileData.profile.bio}</p>
                )}
              </div>
              <ModalCloseButton onClose={onClose} />
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
    </ModalContainer>
  );
}
