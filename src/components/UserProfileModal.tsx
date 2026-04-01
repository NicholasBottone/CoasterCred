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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Profile</h3>
            <p className="text-sm text-gray-500">
              {profileData?.isCurrentUser ? "Your public profile preview" : "Public profile preview"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !profileData ? (
          <p className="text-sm text-gray-400 text-center py-8">Profile not found</p>
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
                <h4 className="text-lg font-bold text-gray-900 truncate">
                  {profileData?.user?.name ?? "Unknown rider"}
                </h4>
                {profileData?.profile?.homepark && (
                  <p className="text-sm text-gray-500 mt-1">🏠 {profileData.profile.homepark}</p>
                )}
                {profileData?.profile?.bio && (
                  <p className="text-sm text-gray-600 mt-1">{profileData.profile.bio}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors"
              >
                <p className="text-2xl font-bold text-primary">{profileData.uniqueCoasterCount}</p>
                <p className="text-xs text-gray-500">Unique Coasters</p>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors"
              >
                <p className="text-lg font-bold text-primary truncate">{profileData.topCoaster?.name ?? "—"}</p>
                <p className="text-xs text-gray-500 mt-2">Current #1</p>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors"
              >
                <p className="text-2xl font-bold text-primary">{profileData.followerCount}</p>
                <p className="text-xs text-gray-500">Followers</p>
              </button>
              <button
                onClick={() => {
                  onClose();
                  onViewProfile(userId);
                }}
                className="bg-gray-50 rounded-xl p-3 text-center hover:bg-gray-100 transition-colors"
              >
                <p className="text-2xl font-bold text-primary">{profileData.followingCount}</p>
                <p className="text-xs text-gray-500">Following</p>
              </button>
            </div>

            {!profileData.isCurrentUser && (
              <button
                onClick={() => void handleFollowToggle()}
                className={`w-full mb-3 rounded-xl py-2.5 text-sm font-semibold ${
                  profileData.isFollowing
                    ? "border border-red-200 text-red-500"
                    : "bg-primary text-white"
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
              className="w-full rounded-xl border border-primary/30 text-primary py-2.5 text-sm font-semibold"
            >
              View Full Profile
            </button>
          </>
        )}
      </div>
    </div>
  );
}
