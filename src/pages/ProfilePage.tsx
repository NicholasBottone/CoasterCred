import { useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { formatDate } from "../lib/dateUtils";
import { Avatar } from "../components/Avatar";
import { getErrorMessage } from "../lib/errors";
import { UserConnectionsModal } from "../components/UserConnectionsModal";

export function ProfilePage({
  onViewPublicProfile,
  themeMode,
  onThemeModeChange,
}: {
  onViewPublicProfile: (userId: string) => void;
  themeMode: "auto" | "light" | "dark";
  onThemeModeChange: (themeMode: "auto" | "light" | "dark") => void;
}) {
  const myProfile = useQuery(api.profiles.getMyProfile);
  const myLogs = useQuery(api.rideLogs.getMyLogs);
  const myRankings = useQuery(api.rankings.getMyRankings);
  const followerCount = useQuery(
    api.profiles.getFollowers,
    myProfile?.user?._id ? { userId: myProfile.user._id as any } : "skip",
  );
  const followingCount = useQuery(
    api.profiles.getFollowing,
    myProfile?.user?._id ? { userId: myProfile.user._id as any } : "skip",
  );
  const upsertProfile = useMutation(api.profiles.upsertProfile);

  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [homepark, setHomepark] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [connectionsKind, setConnectionsKind] = useState<"followers" | "following" | null>(null);

  const handleEdit = () => {
    setDisplayName(myProfile?.user?.name ?? "");
    setBio(myProfile?.profile?.bio ?? "");
    setHomepark(myProfile?.profile?.homepark ?? "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertProfile({
        name: displayName.trim(),
        bio: bio || undefined,
        homepark: homepark || undefined,
      });
      toast.success("Profile updated!");
      setEditing(false);
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not update profile"));
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
  const uniqueCoasterCount = myLogs ? new Set(myLogs.map((log: any) => log.coasterId)).size : 0;
  const authProvider = myProfile?.authProvider;

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      {/* Profile Card */}
      <div className="surface-card p-5 mb-4">
        <div className="flex items-start gap-4">
          <Avatar
            avatarUrl={profile?.avatarUrl ?? user?.image}
            name={user?.name}
            sizeClassName="w-16 h-16"
            textClassName="text-2xl"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
              {user?.name ?? "Enthusiast"}
            </h2>
            {profile?.username && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
                {authProvider === "discord" && <DiscordProviderIcon className="h-3.5 w-3.5 shrink-0" />}
                {authProvider === "google" && <GoogleProviderIcon className="h-3.5 w-3.5 shrink-0" />}
                <p className="truncate">@{profile.username}</p>
              </div>
            )}
            {profile?.homepark && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">🏠 {profile.homepark}</p>
            )}
            {profile?.bio && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{profile.bio}</p>
            )}
          </div>
          <button
            onClick={handleEdit}
            className="shrink-0 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/5 dark:hover:bg-primary/10"
          >
            Edit
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="surface-subtle p-3 text-center">
            <p className="text-2xl font-bold text-primary">{uniqueCoasterCount}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Unique Coasters</p>
          </div>
          <div className="surface-subtle p-3 text-center">
            <p className="text-lg font-bold text-primary truncate">
              {myRankings && myRankings.length > 0
                ? myRankings[0].coaster?.name ?? "—"
                : "—"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Current #1</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            onClick={() => setConnectionsKind("followers")}
            className="surface-subtle interactive-lift p-3 text-center"
          >
            <p className="text-2xl font-bold text-primary">{followerCount ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Followers</p>
          </button>
          <button
            onClick={() => setConnectionsKind("following")}
            className="surface-subtle interactive-lift p-3 text-center"
          >
            <p className="text-2xl font-bold text-primary">{followingCount ?? 0}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Following</p>
          </button>
        </div>
      </div>

      {/* Find Friends */}
      <div className="surface-card p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Find Friends</h3>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="text-xs text-primary font-medium transition-colors hover:text-primary-hover"
          >
            {showSearch ? "Hide" : "Search"}
          </button>
        </div>
        {showSearch && <UserSearch />}
      </div>

      <div className="surface-card p-4 mb-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Appearance</h3>
        <div className="grid grid-cols-3 gap-2">
          {([
            { value: "auto", label: "Auto" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ] as const).map((option) => (
            <button
              key={option.value}
              onClick={() => onThemeModeChange(option.value)}
              className={`rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                themeMode === option.value
                  ? "bg-primary text-white shadow-sm"
                  : "surface-subtle text-gray-700 dark:text-gray-200 interactive-lift"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recent Rides */}
      <div className="surface-card p-4">
        <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Recent Rides</h3>
        {!myLogs || myLogs.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No rides logged yet</p>
        ) : (
          <div className="flex flex-col gap-2">
            {myLogs.slice(0, 10).map((log: any) => (
              <div key={log._id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/70">
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                    {log.coaster?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {log.coaster?.park} · {formatDate(log.rideDate)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4"
          onClick={() => setEditing(false)}
        >
          <div className="surface-card w-full max-w-md shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Edit Profile</h3>
              <button onClick={() => setEditing(false)} className="text-gray-400 dark:text-gray-500 text-xl">×</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Display Name</label>
                <input
                  type="text"
                  value={displayName}
                  maxLength={40}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How other riders will see you"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Connected username</label>
                <div className="input-field bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  {profile?.username ? `@${profile.username}` : "Connected account"}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Home Park</label>
                <input
                  type="text"
                  value={homepark}
                  maxLength={80}
                  onChange={(e) => setHomepark(e.target.value)}
                  placeholder="e.g. Cedar Point"
                  className="input-field"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bio</label>
                <textarea
                  value={bio}
                  maxLength={280}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  rows={3}
                  className="input-field resize-none"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-primary py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md disabled:opacity-50"
              >
                Save Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {connectionsKind && myProfile?.user?._id && (
        <UserConnectionsModal
          userId={myProfile.user._id}
          kind={connectionsKind}
          onClose={() => setConnectionsKind(null)}
          onSelectUser={(userId) => {
            setConnectionsKind(null);
            onViewPublicProfile(userId);
          }}
        />
      )}
    </div>
  );
}

function DiscordProviderIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 127.14 96.36"
      className={className}
      fill="currentColor"
    >
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47.14a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64.14 105.89 105.89 0 0 0 19.39 8.07C2.79 32.65-1.71 56.62.54 80.24A105.73 105.73 0 0 0 32.71 96a77.7 77.7 0 0 0 6.89-11.28 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.04a75.57 75.57 0 0 0 64.32 0c.87.7 1.76 1.38 2.66 2.04a68.68 68.68 0 0 1-10.87 5.19A77 77 0 0 0 94.41 96a105.25 105.25 0 0 0 32.19-15.76c2.64-27.38-4.51-51.14-18.9-72.17ZM42.45 65.69C36.18 65.69 31 59.98 31 52.95s5.06-12.74 11.43-12.74S54 45.92 53.91 52.95c0 7.03-5.06 12.74-11.46 12.74Zm42.24 0c-6.27 0-11.43-5.71-11.43-12.74s5.06-12.74 11.43-12.74S96.15 45.92 96.15 52.95c0 7.03-5.06 12.74-11.46 12.74Z" />
    </svg>
  );
}

function GoogleProviderIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.38c-.48 3.04-3.08 4.34-5.37 4.34a6.42 6.42 0 0 1 0-12.84 5.9 5.9 0 0 1 4.16 1.64l2.12-2.16A8.93 8.93 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19 8.62 8.62 0 0 0 8.98-8.98 7.4 7.4 0 0 0-.13-1.42Z" />
    </svg>
  );
}

function UserSearch() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const results = useQuery(api.profiles.searchUsers, { q: debouncedQ });
  const myProfile = useQuery(api.profiles.getMyProfile);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [q]);

  return (
    <div>
      <input
        type="text"
        placeholder="Search by display name or exact username..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input-field mb-2"
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
        <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">No users found</p>
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
      toast.error(getErrorMessage(e, "Could not update follow status"));
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/70">
      <Avatar
        avatarUrl={user.profile?.avatarUrl}
        name={user.name}
        sizeClassName="w-8 h-8"
        textClassName="text-sm"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{user.name ?? "Enthusiast"}</p>
        {user.profile?.username && (
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">@{user.profile.username}</p>
        )}
      </div>
      <button
        onClick={handleToggle}
        className={`text-xs px-3 py-1.5 rounded-lg font-medium shrink-0 ${
          isFollowing
            ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-200"
            : "bg-primary text-white"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}
