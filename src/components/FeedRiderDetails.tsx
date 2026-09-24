import { FeedEventBadge, type FeedEventBadgeData } from "./FeedEventBadge";

function attributedBadgeLabel(name: string, badge: FeedEventBadgeData) {
  const label = badge.variant === "countryFirst"
    ? badge.label.replace(/^First\b/, "first")
    : badge.label;
  return `${name}'s ${label}`;
}

export function FeedRiderDetails({
  name,
  badges,
  notes,
}: {
  name: string;
  badges: FeedEventBadgeData[];
  notes?: string | null;
}) {
  if (badges.length === 0 && !notes) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs">
      {badges.map((badge, index) => (
        <FeedEventBadge
          key={`${badge.label}-${index}`}
          badge={{ ...badge, label: attributedBadgeLabel(name, badge) }}
        />
      ))}
      {notes && (
        <span className="italic text-gray-600 dark:text-gray-300">
          “{notes}” <span className="whitespace-nowrap not-italic text-gray-500 dark:text-gray-400">— {name}</span>
        </span>
      )}
    </div>
  );
}
