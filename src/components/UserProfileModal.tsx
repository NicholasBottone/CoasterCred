import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import { formatDate } from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";

export function UserProfileModal({
  userId,
  onClose,
}: {
  userId: string;
  onClose: () => void;
}) {
  const myProfile = useQuery(api.profiles.getMyProfile);
  const profileData = useQuery(api.profiles.getProfile, { userId: userId as any });
  const userLogs = useQuery(api.rideLogs.getUserLogs, { userId: userId as any });
  const userRankings = useQuery(api.rankings.getUserRankings, { userId: userId as any });
  const isFollowing = useQuery(api.profiles.isFollowing, { targetUserId: userId as any });
  const unfollow = useMutation(api.profiles.unfollow);

  const isCurrentUser = myProfile?.user?._id === userId;
  const loading =
    profileData === undefined ||
    userLogs === undefined ||
    userRankings === undefined ||
    (!isCurrentUser && isFollowing === undefined);

  const handleUnfollow = async () => {
    try {
      await unfollow({ targetUserId: userId as any });
      toast.success("Unfollowed");
      onClose();
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not unfollow"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Profile</h3>
            <p className="text-sm text-gray-500">
              {isCurrentUser ? "Your coaster stats" : "Recent activity and details"}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-4 mb-4">
              <Avatar
                avatarUrl={profileData?.profile?.avatarUrl}
                name={profileData?.user?.name}
                email={profileData?.user?.email}
                sizeClassName="w-16 h-16"
                textClassName="text-2xl"
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold text-gray-900 truncate">
                  {profileData?.user?.name ?? "Unknown rider"}
                </h4>
                {isCurrentUser && profileData?.user?.email && (
                  <p className="text-xs text-gray-400 truncate">{profileData.user.email}</p>
                )}
                {profileData?.profile?.homepark && (
                  <p className="text-sm text-gray-500 mt-1">🏠 {profileData.profile.homepark}</p>
                )}
                {profileData?.profile?.bio && (
                  <p className="text-sm text-gray-600 mt-1">{profileData.profile.bio}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-2xl font-bold text-primary">{new Set((userLogs ?? []).map((log: any) => log.coasterId)).size}</p>
                <p className="text-xs text-gray-500">Unique Coasters</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-bold text-primary truncate">
                  {userRankings && userRankings.length > 0
                    ? userRankings[0].coaster?.name ?? "—"
                    : "—"}
                </p>
                <p className="text-xs text-gray-500">Current #1</p>
              </div>
            </div>

            {!isCurrentUser && isFollowing && (
              <button
                onClick={() => void handleUnfollow()}
                className="w-full mb-4 rounded-xl border border-red-200 text-red-500 py-2.5 text-sm font-semibold"
              >
                Unfollow
              </button>
            )}

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800">Recent Rides</h4>
                <span className="text-xs text-gray-400">{(userLogs ?? []).length} total</span>
              </div>
              {!userLogs || userLogs.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No rides logged yet</p>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {userLogs.slice(0, 8).map((log: any) => (
                    <div key={log._id} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                      <p className="text-sm font-medium text-gray-800">{log.coaster?.name ?? "Unknown"}</p>
                      <p className="text-xs text-gray-400">
                        {log.coaster?.park} · {formatDate(log.rideDate)}
                      </p>
                      {log.notes && (
                        <p className="text-xs text-gray-500 mt-1">{log.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
