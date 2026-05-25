export type RideEventBadgeVariant =
  | "historical"
  | "first"
  | "repeat"
  | "countMilestone"
  | "countryFirst";

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

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  argentina: "AR",
  australia: "AU",
  austria: "AT",
  belgium: "BE",
  brazil: "BR",
  bulgaria: "BG",
  canada: "CA",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  croatia: "HR",
  czechia: "CZ",
  "czech republic": "CZ",
  denmark: "DK",
  egypt: "EG",
  finland: "FI",
  france: "FR",
  germany: "DE",
  greece: "GR",
  hungary: "HU",
  india: "IN",
  indonesia: "ID",
  ireland: "IE",
  italy: "IT",
  japan: "JP",
  malaysia: "MY",
  mexico: "MX",
  morocco: "MA",
  netherlands: "NL",
  "new zealand": "NZ",
  norway: "NO",
  philippines: "PH",
  poland: "PL",
  portugal: "PT",
  qatar: "QA",
  romania: "RO",
  "saudi arabia": "SA",
  serbia: "RS",
  singapore: "SG",
  slovakia: "SK",
  slovenia: "SI",
  "south africa": "ZA",
  "south korea": "KR",
  korea: "KR",
  spain: "ES",
  sweden: "SE",
  switzerland: "CH",
  taiwan: "TW",
  thailand: "TH",
  turkey: "TR",
  "united arab emirates": "AE",
  uae: "AE",
  uk: "GB",
  "united kingdom": "GB",
  england: "GB",
  scotland: "GB",
  "united states": "US",
  usa: "US",
  vietnam: "VN",
};

function getCountryFlagEmoji(country?: string) {
  if (!country) {
    return "🌍";
  }

  const normalized = country.trim().toLowerCase();
  const code = COUNTRY_CODE_BY_NAME[normalized] ?? (country.trim().match(/^[A-Za-z]{2}$/) ? country.trim().toUpperCase() : null);
  if (!code) {
    return "🌍";
  }

  return String.fromCodePoint(
    ...code.split("").map((char) => 0x1f1e6 + char.charCodeAt(0) - 65),
  );
}

export function getRideEventBadgeEmoji(
  variant: RideEventBadgeVariant,
  options?: { country?: string; value?: number },
) {
  if (variant === "countryFirst") {
    return getCountryFlagEmoji(options?.country);
  }

  if (variant === "countMilestone") {
    if (options?.value === 100) return "💯";
    if (typeof options?.value === "number" && options.value % 100 === 0) return "🏆";
    return "✨";
  }

  if (variant === "first") {
    return "🎉";
  }

  if (variant === "historical") {
    return "🕰️";
  }

  return "🔁";
}

export function getRideEventBadgeClasses(variant: RideEventBadgeVariant) {
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ring-1";

  if (variant === "countMilestone") {
    return `${base} bg-gradient-to-r from-amber-50 to-orange-100 text-amber-900 ring-amber-200 shadow-amber-100/80 dark:from-amber-500/15 dark:to-orange-500/20 dark:text-amber-100 dark:ring-amber-500/30`;
  }

  if (variant === "countryFirst") {
    return `${base} bg-gradient-to-r from-cyan-50 to-sky-100 text-cyan-900 ring-cyan-200 shadow-cyan-100/80 dark:from-cyan-500/15 dark:to-sky-500/20 dark:text-cyan-100 dark:ring-cyan-500/30`;
  }

  if (variant === "historical") {
    return `${base} bg-gray-100 text-gray-600 ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700`;
  }

  if (variant === "first") {
    return `${base} bg-gradient-to-r from-emerald-50 to-lime-100 text-emerald-900 ring-emerald-200 shadow-emerald-100/80 dark:from-emerald-500/15 dark:to-lime-500/20 dark:text-emerald-100 dark:ring-emerald-500/30`;
  }

  return `${base} bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:ring-blue-500/25`;
}

export function getRideEventBadgeIconClasses(variant: RideEventBadgeVariant) {
  const base =
    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-[12px] shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10";

  if (variant === "countMilestone") {
    return `${base}`;
  }

  if (variant === "countryFirst") {
    return `${base}`;
  }

  if (variant === "first") {
    return `${base}`;
  }

  return `${base}`;
}
