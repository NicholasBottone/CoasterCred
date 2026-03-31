import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function ProfilePage() {
  const myProfile = useQuery(api.profiles.getMyProfile);
  const myLogs = useQuery(api.rideLogs.getMyLogs);
  const myRankings = useQuery(api.rankings.getMyRankings);
  const upsertProfile = useMutation(api.profiles.upsertProfile);

  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [homepark, setHomepark] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  const handleEdit = () => {
    setBio(myProfile?.profile?.bio ?? "");
    setHomepark(myProfile?.profile?.homepark ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertProfile({ bio: bio || undefined, homepark: homepark || undefined });
      toast.success("Profile updated!");
      setEditing(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  if (myProfile === undefined) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const user = myProfile?.user;
  const profile = myProfile?.profile;

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Profile Card */}
      <div className="bg-white rounded-2xl border shadow-sm p-5 mb-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
            {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 truncate">
              {user?.name ?? user?.email ?? "Enthusiast"}
            </h2>
            {user?.email && user?.name && (
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            )}
            {profile?.homepark && (
              <p className="text-sm text-gray-500 mt-0.5">🏠 {profile.homepark}</p>
            )}
            {profile?.bio && (
              <p className="text-sm text-gray-600 mt-1">{profile.bio}</p>
            )}
          </div>
          <button
            onClick={handleEdit}
            className="text-xs text-primary border border-primary/30 px-3 py-1.5 rounded-lg font-medium shrink-0"
          >
            Edit
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{myLogs?.length ?? 0}</p>
            <p className="text-xs text-gray-500">Coasters Ridden</p>
          </div>
          <div className="bg-gray-50 rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-primary truncate">
              {myRankings && myRankings.length > 0
                ? myRankings[0].coaster?.name ?? "—"
                : "—"}
            </p>
            <p className="text-xs text-gray-500">Current #1</p>
          </div>
        </div>
      </div>

      {/* Find Friends */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">Find Friends</h3>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-xs text-primary font-medium"
          >
            {showSearch ? "Hide" : "Search"}
          </button>
        </div>
        {showSearch && <UserSearch />}
      </div>

      {/* Recent Rides */}
      <div className="bg-white rounded-2xl border shadow-sm p-4">
        <h3 className="font-semibold text-gray-800 mb-3">Recent Rides</h3>
        {!myLogs || myLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No rides logged yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myLogs.slice(0, 10).map((log: any) => (
              <div key={log._id} className="flex items-center gap-3 py-1">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {log.coaster?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-400">{log.coaster?.park}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit Profile</h3>
              <button onClick={() => setEditing(false)} className="text-gray-400 text-xl">×</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Home Park</label>
                <input
                  type="text"
                  value={homepark}
                  onChange={(e) => setHomepark(e.target.value)}
                  placeholder="e.g. Cedar Point"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserSearch() {
  const [q, setQ] = useState("");
  const results = useQuery(api.profiles.searchUsers, { q });
  const follow = useMutation(api.profiles.follow);
  const unfollow = useMutation(api.profiles.unfollow);
  const myProfile = useQuery(api.profiles.getMyProfile);

  return (
    <div>
      <input
        type="text"
        placeholder="Search by name or email..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 mb-2"
      />
      {results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results
            .filter((u: any) => u._id !== myProfile?.user?._id)
            .map((u: any) => (
              <UserRow key={u._id} user={u} />
            ))}
        </div>
      )}
      {results && results.length === 0 && q.trim() && (
        <p className="text-xs text-gray-400 text-center py-2">No users found</p>
      )}
    </div>
  );
}

function UserRow({ user }: { user: any }) {
  const isFollowing = useQuery(api.profiles.isFollowing, { targetUserId: user._id });
  const follow = useMutation(api.profiles.follow);
  const unfollow = useMutation(api.profiles.unfollow);

  const handleToggle = async () => {
    try {
      if (isFollowing) {
        await unfollow({ targetUserId: user._id });
        toast.success("Unfollowed");
      } else {
        await follow({ targetUserId: user._id });
        toast.success("Following!");
      }
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
        {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? "?"}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 truncate">{user.name ?? user.email}</p>
        {user.name && <p className="text-xs text-gray-400 truncate">{user.email}</p>}
      </div>
      <button
        onClick={handleToggle}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium shrink-0 ${
          isFollowing
            ? "bg-gray-100 text-gray-600"
            : "bg-primary text-white"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}
