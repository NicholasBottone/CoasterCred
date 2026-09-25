export type RideEventBadgeVariant =
  "historical" | "first" | "repeat" | "countMilestone" | "countryFirst";

export function getCoasterMaterialClasses(type?: string) {
  const tone =
    type === "Wood"
      ? "wood"
      : type === "Steel"
        ? "steel"
        : type === "Hybrid"
          ? "hybrid"
          : "unknown";
  return `material-label material-${tone}`;
}

export function getRideEventBadgeClasses(variant: RideEventBadgeVariant) {
  return variant === "historical" || variant === "repeat"
    ? "ride-event ride-event-muted"
    : "ride-event";
}
