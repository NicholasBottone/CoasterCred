import {
  getRideEventBadgeClasses,
  getRideEventBadgeEmoji,
  getRideEventBadgeIconClasses,
  type RideEventBadgeVariant,
} from "../lib/badges";

export type FeedEventBadgeData = {
  label: string;
  variant: RideEventBadgeVariant;
  country?: string;
  value?: number;
};

export function FeedEventBadge({ badge }: { badge: FeedEventBadgeData }) {
  const emoji = getRideEventBadgeEmoji(badge.variant, {
    country: badge.country,
    value: badge.value,
  });

  return (
    <div className={getRideEventBadgeClasses(badge.variant)}>
      <span aria-hidden="true" className={getRideEventBadgeIconClasses(badge.variant)}>
        {emoji}
      </span>
      <span>{badge.label}</span>
    </div>
  );
}
