import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDate, formatDistanceToNow } from "../lib/dateUtils";
import { Avatar } from "../components/Avatar";
import { CoasterModal } from "../components/CoasterModal";
import { FeedEventBadge } from "../components/FeedEventBadge";
import { type CoasterSummary } from "../lib/coasterData";
import { UserProfileModal } from "../components/UserProfileModal";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterTypeBadgeClasses } from "../lib/badges";

export function FeedPage({
  onViewPublicProfile,
  onOpenSearch,
}: {
  onViewPublicProfile: (userId: string) => void;
  onOpenSearch: () => void;
}) {
  const feed = useQuery(api.rideLogs.getFeed);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  if (feed === undefined) {
    return <LoadingSpinner />;
  }

  if (feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="text-5xl mb-4">🎢</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Your feed is empty</h2>
        <p className="text-gray-500 text-sm">
          Follow other enthusiasts or log your first ride to get started!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="surface-card flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-gray-500 transition-colors hover:border-primary/30 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Search for a coaster or a member"
        >
          <span aria-hidden="true" className="text-base leading-none">🔍</span>
          <span>Search for a coaster or a member</span>
        </button>
        <h2 className="ui-copy-disabled text-lg font-bold text-gray-800 dark:text-gray-100">Activity Feed</h2>
        {feed.map((item: any) => (
          <FeedCard
            key={item._id}
            item={item}
            onSelectCoaster={(coaster) => setSelectedCoaster(coaster)}
            onSelectUser={(userId) => setSelectedUserId(userId)}
          />
        ))}
      </div>

      {selectedCoaster && (
        <CoasterModal coaster={selectedCoaster} onClose={() => setSelectedCoaster(null)} />
      )}

      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onViewProfile={(userId) => {
            setSelectedUserId(null);
            onViewPublicProfile(userId);
          }}
        />
      )}
    </>
  );
}

function FeedCard({
  item,
  onSelectCoaster,
  onSelectUser,
}: {
  item: any;
  onSelectCoaster: (coaster: CoasterSummary) => void;
  onSelectUser: (userId: string) => void;
}) {
  const coaster = item.coaster;
  const user = item.user;
  const profile = item.profile;
  const badges = Array.isArray(item.feedHighlights) && item.feedHighlights.length > 0
    ? item.feedHighlights.map((highlight: any) => ({
        label: highlight.label,
        variant: highlight.kind,
        country: highlight.country,
        value: highlight.value,
      }))
    : item.isFirstRide
      ? [{ label: "First ride", variant: "first" as const }]
      : [];

  return (
    <div className="surface-card interactive-lift rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => onSelectUser(user?._id)}
          className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
        >
          <Avatar
            avatarUrl={profile?.avatarUrl}
            name={user?.name}
            sizeClassName="w-9 h-9"
            textClassName="text-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">
              {user?.name ?? "Unknown"}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">{formatDistanceToNow(item._creationTime)}</p>
          </div>
        </button>
        <div className="ml-auto flex flex-wrap justify-end gap-2">
          {badges.map((badge: { label: string; variant: "first" | "countMilestone" | "countryFirst"; country?: string; value?: number }, index: number) => (
            <FeedEventBadge key={`${badge.label}-${index}`} badge={badge} />
          ))}
        </div>
      </div>
      <button
        onClick={() => onSelectCoaster(coaster)}
        className="interactive-lift w-full surface-subtle p-3 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-bold text-gray-900 dark:text-gray-100">{coaster?.name ?? "Unknown Coaster"}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{coaster?.park} · {coaster?.location}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={getCoasterTypeBadgeClasses(coaster?.type)}>
              {coaster?.type}
            </span>
            {typeof item.score === "number" ? (
              <ScoreBadge score={item.score} size="sm" />
            ) : typeof item.rank === "number" ? (
              <span className="rounded-full border border-primary/20 px-2 py-1 text-[11px] font-medium text-primary dark:border-primary/30">
                #{item.rank}
              </span>
            ) : null}
          </div>
        </div>
        {item.notes && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 italic">"{item.notes}"</p>
        )}
        <p className="mt-2 text-xs text-gray-400">
          Rode on {formatDate(item.rideDate)}
        </p>
      </button>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
