import {
  getRideEventBadgeClasses,
  type RideEventBadgeVariant,
} from "../lib/badges";
import { Award, Globe2, Flag, History, Repeat2 } from "lucide-react";

export type FeedEventBadgeData = {
  label: string;
  variant: RideEventBadgeVariant;
  country?: string;
  value?: number;
};

export function FeedEventBadge({ badge }: { badge: FeedEventBadgeData }) {
  const Icon = {
    countMilestone: Award,
    countryFirst: Globe2,
    first: Flag,
    historical: History,
    repeat: Repeat2,
  }[badge.variant];

  return (
    <div className={getRideEventBadgeClasses(badge.variant)}>
      <Icon aria-hidden="true" />
      <span>{badge.label}</span>
    </div>
  );
}
