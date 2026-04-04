export const COASTERPEDIA_SOURCE = "coasterpedia";
export const COASTERPEDIA_API = "https://coasterpedia.net/w/api.php";

export type ImportedCoaster = {
  _id?: string;
  source: string;
  sourceId: string;
  sourceUrl?: string;
  lastSyncedAt: number;
  name: string;
  park: string;
  location: string;
  type: string;
  manufacturer?: string;
  product?: string;
  propulsion?: string;
  durationSeconds?: number;
  status?: string;
  heightFt?: number;
  speedMph?: number;
  lengthFt?: number;
  inversions?: number;
  yearOpened?: number;
  imageUrl?: string;
};

function cleanWikiText(value: string | undefined) {
  if (!value) return "";

  return value
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^{}|]+\|([^{}]+)\}\}/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/''+/g, "")
    .trim();
}

function parseInfobox(wikitext: string) {
  const match = wikitext.match(
    /\{\{Infobox (?:roller coaster|coaster multitrack)([\s\S]*?)\n\}\}/i,
  );
  if (!match) {
    throw new Error("Could not find coaster infobox");
  }

  const fields: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const fieldMatch = line.match(/^\|([^=]+?)\s*=\s*(.*)$/);
    if (!fieldMatch) continue;
    fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
  }
  return fields;
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = cleanWikiText(value).match(/-?\d+(\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : undefined;
}

function parseDurationSeconds(value: string | undefined) {
  const cleaned = cleanWikiText(value);
  if (!cleaned) return undefined;

  const match = cleaned.match(/^(?:(\d+):)?(\d{1,2})$/);
  if (!match) return undefined;

  const minutes = Number(match[1] ?? 0);
  const seconds = Number(match[2]);
  return minutes * 60 + seconds;
}

function formatStatus(value: string | undefined) {
  const cleaned = cleanWikiText(value).trim();
  if (!cleaned) return undefined;
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function deriveType(fields: Record<string, string>) {
  const categories = ["category1", "category2", "category3", "category4"]
    .map((key) => cleanWikiText(fields[key]).toLowerCase())
    .filter(Boolean);

  if (categories.some((category) => category.includes("hybrid"))) return "Hybrid";
  if (categories.some((category) => category.includes("wood"))) return "Wood";
  return "Steel";
}

function extractYear(value: string | undefined) {
  if (!value) return undefined;
  const match = cleanWikiText(value).match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

function normalizeLocation(fields: Record<string, string>) {
  const city = cleanWikiText(fields.location);
  const state = cleanWikiText(fields.state);
  const country = cleanWikiText(fields.country);
  const parts = [city, state || country].filter(Boolean);
  return parts.join(", ");
}

export function normalizeCoaster(page: any): ImportedCoaster {
  const revision = page.revisions?.[0]?.slots?.main?.["*"];
  if (!revision) {
    throw new Error(`Missing revision content for ${page.title}`);
  }

  const fields = parseInfobox(revision);
  const park = cleanWikiText(fields.park);
  const location = normalizeLocation(fields);

  return {
    source: COASTERPEDIA_SOURCE,
    sourceId: String(page.pageid),
    sourceUrl: page.canonicalurl ?? page.fullurl,
    lastSyncedAt: Date.now(),
    name: cleanWikiText(fields.name) || page.title,
    park,
    location,
    type: deriveType(fields),
    manufacturer: cleanWikiText(fields.manufacturer) || undefined,
    product: cleanWikiText(fields.product) || undefined,
    propulsion: cleanWikiText(fields.propulsion ?? fields["lift/launch"]) || undefined,
    durationSeconds: parseDurationSeconds(fields.duration),
    status: formatStatus(fields.status),
    heightFt: parseNumber(fields.height),
    speedMph: parseNumber(fields.speed),
    lengthFt: parseNumber(fields.length),
    inversions: parseNumber(fields.inversions),
    yearOpened: extractYear(fields.opened),
    imageUrl: undefined,
  };
}

export async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "CoasterCred/1.0 (catalog integration)",
    },
  });

  if (!response.ok) {
    throw new Error(`Coasterpedia request failed with ${response.status}`);
  }

  return await response.json();
}

export function buildApiUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams({
    format: "json",
    ...params,
  });
  return `${COASTERPEDIA_API}?${searchParams.toString()}`;
}

export async function fetchCoasterpediaPages(params: Record<string, string>) {
  const details = await fetchJson(
    buildApiUrl({
      action: "query",
      prop: "info|revisions",
      inprop: "url",
      rvprop: "content",
      rvslots: "main",
      redirects: "1",
      ...params,
    }),
  );
  return Object.values((details as any).query?.pages ?? {}) as any[];
}

export async function searchCoasterpediaTitles(queryText: string) {
  const openSearchResults = (await fetchJson(
    buildApiUrl({
      action: "opensearch",
      search: queryText,
      limit: "8",
      namespace: "0",
    }),
  )) as [string, string[], string[], string[]];

  return (openSearchResults[1] ?? []).filter(Boolean);
}

export async function fetchCoasterpediaPageById(sourceId: string) {
  const details = await fetchJson(
    buildApiUrl({
      action: "query",
      pageids: sourceId,
      prop: "info|revisions",
      inprop: "url",
      rvprop: "content",
      rvslots: "main",
    }),
  );

  return (details as any).query?.pages?.[sourceId] ?? null;
}
