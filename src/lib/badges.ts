export function getCoasterTypeBadgeClasses(type?: string) {
  const base =
    "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1";

  if (type === "Hybrid") {
    return `${base} bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-200 dark:bg-fuchsia-500/10 dark:text-fuchsia-200 dark:ring-fuchsia-500/25`;
  }

  if (type === "Wood") {
    return `${base} bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25`;
  }

  return `${base} bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-200 dark:ring-sky-500/25`;
}

export function getRideEventBadgeClasses(isFirstRide: boolean) {
  const base =
    "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1";

  if (isFirstRide) {
    return `${base} bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/25`;
  }

  return `${base} bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/25`;
}
