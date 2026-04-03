import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { Avatar } from "./Avatar";
import { getErrorMessage } from "../lib/errors";

export function MemberSearchPanel({
  viewerUserId,
  autoFocus = false,
}: {
  viewerUserId: string | null;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const results = useQuery(api.profiles.searchUsers, { q: debouncedQ });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 250);

    return () => clearTimeout(timeout);
  }, [q]);

  useEffect(() => {
    if (!autoFocus) return;

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [autoFocus]);

  return (
    <div>
      <input
        ref={inputRef}
        data-search-autofocus={autoFocus ? "true" : undefined}
        type="text"
        placeholder="Search by display name or exact username..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="input-field mb-2"
      />
      {results && results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results
            .filter((user: any) => user._id !== viewerUserId)
            .map((user: any) => (
              <MemberSearchRow key={user._id} user={user} />
            ))}
        </div>
      )}
      {results && results.length === 0 && q.trim() && (
        <p className="py-2 text-center text-xs text-gray-400 dark:text-gray-500">No users found</p>
      )}
    </div>
  );
}

function MemberSearchRow({ user }: { user: any }) {
  const follow = useMutation(api.profiles.follow);
  const unfollow = useMutation(api.profiles.unfollow);

  const handleToggle = async () => {
    try {
      if (user.isFollowing) {
        await unfollow({ targetUserId: user._id });
        toast.success("Unfollowed");
      } else {
        await follow({ targetUserId: user._id });
        toast.success("Following!");
      }
    } catch (error: any) {
      toast.error(getErrorMessage(error, "Could not update follow status"));
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
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
          {user.name ?? "Enthusiast"}
        </p>
        {user.profile?.username && (
          <p className="truncate text-xs text-gray-400 dark:text-gray-500">@{user.profile.username}</p>
        )}
      </div>
      <button
        onClick={handleToggle}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${
          user.isFollowing
            ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-200"
            : "bg-primary text-white"
        }`}
      >
        {user.isFollowing ? "Following" : "Follow"}
      </button>
    </div>
  );
}
