import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { Home, SlidersHorizontal } from "lucide-react";
import { PageHeading } from "../components/TrackMotif";
import { ProfileSummary } from "../components/ProfileSummary";
import { RecentRides } from "../components/RecentRides";
import { Avatar } from "../components/Avatar";
import { getErrorMessage } from "../lib/errors";
import { UserConnectionsModal } from "../components/UserConnectionsModal";
import { ModalCloseButton } from "../components/ModalContainer";
import { SignOutButton } from "../SignOutButton";
import { ProfileWrappedStats } from "../components/ProfileWrappedStats";
import { CoasterModal } from "../components/CoasterModal";
import { type CoasterSummary } from "../lib/coasterData";

export function ProfilePage({
  onViewPublicProfile,
  onOpenMyList,
  themeMode,
  onThemeModeChange,
}: {
  onViewPublicProfile: (userId: string) => void;
  onOpenMyList: () => void;
  themeMode: "auto" | "light" | "dark";
  onThemeModeChange: (themeMode: "auto" | "light" | "dark") => void;
}) {
  const dashboard = useQuery(api.profiles.getMyProfileDashboard);
  const upsertProfile = useMutation(api.profiles.upsertProfile);

  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [homepark, setHomepark] = useState("");
  const [saving, setSaving] = useState(false);
  const [connectionsKind, setConnectionsKind] = useState<
    "followers" | "following" | null
  >(null);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(
    null,
  );

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

  if (dashboard === undefined) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const myProfile = dashboard;
  const user = dashboard?.user;
  const profile = dashboard?.profile;
  const uniqueCoasterCount = dashboard?.uniqueCoasterCount ?? 0;
  const authProvider = dashboard?.authProvider;

  return (
    <div className="page-content profile-page">
      <PageHeading title="Rider profile" motif="airtime" eyebrow />
      <div className="profile-intro">
        <div className="flex items-start gap-3 sm:gap-4">
          <Avatar
            avatarUrl={profile?.avatarUrl ?? user?.image}
            name={user?.name}
            sizeClassName="h-14 w-14 sm:h-16 sm:w-16"
            textClassName="text-2xl"
          />
          <div className="min-w-0 flex-1">
            <h1>{user?.name ?? "Enthusiast"}</h1>
            {profile?.username && (
              <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                {authProvider === "discord" && (
                  <DiscordProviderIcon className="h-3.5 w-3.5 shrink-0" />
                )}
                {authProvider === "google" && (
                  <GoogleProviderIcon className="h-3.5 w-3.5 shrink-0" />
                )}
                <p className="truncate">@{profile.username}</p>
              </div>
            )}
            {profile?.homepark && (
              <p className="mt-2 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Home size={14} aria-hidden="true" />
                {profile.homepark}
              </p>
            )}
            {profile?.bio && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                {profile.bio}
              </p>
            )}
            <div className="profile-connections">
              <button
                type="button"
                onClick={() => setConnectionsKind("followers")}
              >
                <strong>{dashboard?.followerCount ?? 0}</strong>{" "}
                {dashboard?.followerCount === 1 ? "follower" : "followers"}
              </button>
              <button
                type="button"
                onClick={() => setConnectionsKind("following")}
              >
                <strong>{dashboard?.followingCount ?? 0}</strong> following
              </button>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-1">
            <button
              type="button"
              onClick={handleEdit}
              className="min-h-11 px-2 text-xs font-medium text-primary"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setAppearanceOpen(!appearanceOpen)}
              aria-label="Appearance settings"
              aria-expanded={appearanceOpen}
              className="flex h-11 w-11 items-center justify-center rounded border border-gray-200 dark:border-gray-800"
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        {appearanceOpen && (
          <div className="profile-settings">
            <label htmlFor="profile-appearance" className="text-sm">
              Appearance
            </label>
            <select
              id="profile-appearance"
              value={themeMode}
              onChange={(event) =>
                onThemeModeChange(event.target.value as typeof themeMode)
              }
            >
              <option value="auto">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        )}
      </div>
      <ProfileSummary
        count={uniqueCoasterCount}
        topName={dashboard?.topCoaster?.name}
        onOpen={onOpenMyList}
      />
      <div className="profile-grid">
        <ProfileWrappedStats
          stats={dashboard?.wrappedStats}
          onSelectCoaster={setSelectedCoaster}
        />
        <RecentRides
          rides={dashboard?.recentRides ?? []}
          onSelectCoaster={setSelectedCoaster}
        />
      </div>
      <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-800">
        <SignOutButton className="min-h-11 text-sm text-gray-500 dark:text-gray-400" />
      </div>

      {/* Edit Modal */}
      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4"
          onClick={() => setEditing(false)}
        >
          <div
            className="surface-card w-full max-w-md shadow-xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Edit Profile
              </h3>
              <ModalCloseButton onClose={() => setEditing(false)} />
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Display Name
                </label>
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
                <label className="text-xs text-gray-500 mb-1 block">
                  Connected username
                </label>
                <div className="input-field bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400">
                  {profile?.username
                    ? `@${profile.username}`
                    : "Connected account"}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Home Park
                </label>
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
                className="rounded-md bg-primary py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
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
      {selectedCoaster && (
        <CoasterModal
          coaster={selectedCoaster}
          onClose={() => setSelectedCoaster(null)}
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
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
    >
      <path d="M21.35 11.1H12v2.98h5.38c-.48 3.04-3.08 4.34-5.37 4.34a6.42 6.42 0 0 1 0-12.84 5.9 5.9 0 0 1 4.16 1.64l2.12-2.16A8.93 8.93 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19 8.62 8.62 0 0 0 8.98-8.98 7.4 7.4 0 0 0-.13-1.42Z" />
    </svg>
  );
}
