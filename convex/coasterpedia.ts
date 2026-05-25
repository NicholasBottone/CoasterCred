export const COASTERPEDIA_SOURCE = "coasterpedia";
export const COASTERPEDIA_API = "https://coasterpedia.net/w/api.php";

export type ImportedCoaster = {
  _id?: string;
  source: string;
  sourceId: string;
  sourcePageId?: string;
  sourceUrl?: string;
  lastSyncedAt: number;
  name: string;
  parentName?: string;
  park: string;
  location: string;
  type: string;
  isMultiTrack?: boolean;
  multiTrackGroupId?: string;
  trackName?: string;
  trackIndex?: number;
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

type MeasurementSystem = "metric" | "imperial";

const METERS_TO_FEET = 3.28084;
const KMH_TO_MPH = 0.621371;

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

function extractInfoboxTemplate(wikitext: string) {
  const startMatch = /\{\{Infobox (roller coaster|coaster multitrack)\b/i.exec(wikitext);
  if (!startMatch || startMatch.index === undefined) {
    throw new Error("Could not find coaster infobox");
  }

  const templateStart = startMatch.index;
  const contentStart = templateStart + startMatch[0].length;
  let templateDepth = 0;
  let templateEnd = -1;

  for (let index = templateStart; index < wikitext.length - 1; index += 1) {
    const token = wikitext.slice(index, index + 2);
    if (token === "{{") {
      templateDepth += 1;
      index += 1;
      continue;
    }
    if (token === "}}") {
      templateDepth -= 1;
      index += 1;
      if (templateDepth === 0) {
        templateEnd = index + 1;
        break;
      }
    }
  }

  if (templateEnd === -1) {
    throw new Error("Could not find the end of the coaster infobox");
  }

  return {
    templateName: startMatch[1].toLowerCase(),
    body: wikitext.slice(contentStart, templateEnd - 2),
  };
}

function parseInfobox(wikitext: string) {
  const template = extractInfoboxTemplate(wikitext);

  const fields: Record<string, string> = {};
  for (const line of template.body.split("\n")) {
    const fieldMatch = line.match(/^\|([^=]+?)\s*=\s*(.*)$/);
    if (!fieldMatch) continue;
    fields[fieldMatch[1].trim()] = fieldMatch[2].trim();
  }
  return {
    templateName: template.templateName,
    fields,
  };
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const cleaned = cleanWikiText(value).match(/-?\d+(\.\d+)?/);
  return cleaned ? Number(cleaned[0]) : undefined;
}

function inferMeasurementSystem(value: string | undefined): MeasurementSystem | undefined {
  const cleaned = cleanWikiText(value).toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned.includes("metric")) return "metric";
  if (cleaned.includes("imperial") || cleaned.includes("english")) return "imperial";
  return undefined;
}

function normalizeMeasurement(
  value: string | undefined,
  fallbackSystem: MeasurementSystem | undefined,
  options: {
    metricPattern: RegExp;
    imperialPattern: RegExp;
    convertMetric: (numericValue: number) => number;
  },
) {
  const numericValue = parseNumber(value);
  if (numericValue === undefined) return undefined;

  const rawValue = value?.toLowerCase() ?? "";
  const detectedSystem = options.metricPattern.test(rawValue)
    ? "metric"
    : options.imperialPattern.test(rawValue)
      ? "imperial"
      : fallbackSystem;

  if (detectedSystem === "metric") {
    return Math.round(options.convertMetric(numericValue));
  }

  return numericValue;
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

function slugifyTrackName(trackName: string) {
  return cleanWikiText(trackName)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function buildCoasterGroupId(sourcePageId: string) {
  return `${COASTERPEDIA_SOURCE}:${sourcePageId}`;
}

export function getCoasterSourcePageId(sourceId: string) {
  return sourceId.split("::")[0] ?? sourceId;
}

export function buildTrackSourceId(sourcePageId: string, trackIndex: number, trackName: string) {
  return `${sourcePageId}::${trackIndex + 1}::${slugifyTrackName(trackName)}`;
}

export function formatCoasterName(parentName: string, trackName?: string) {
  return trackName ? `${parentName} (${trackName})` : parentName;
}

function getTrackNames(fields: Record<string, string>) {
  const trackNames: string[] = [];

  for (let index = 1; index <= 8; index += 1) {
    const trackName = cleanWikiText(fields[`track${index}_name`] ?? fields[`multi-track${index}`]);
    if (trackName) {
      trackNames.push(trackName);
    }
  }

  return trackNames;
}

function getTrackField(fields: Record<string, string>, baseFieldName: string, trackIndex: number) {
  if (trackIndex === 0) {
    return fields[baseFieldName] ?? fields[`${baseFieldName}1`];
  }

  return fields[`${baseFieldName}${trackIndex + 1}`] ?? fields[baseFieldName];
}

function buildImportedCoaster(
  page: any,
  fields: Record<string, string>,
  options: {
    sourcePageId: string;
    sourceUrl?: string;
    park: string;
    location: string;
    measurementSystem: MeasurementSystem | undefined;
    parentName: string;
    isMultiTrack: boolean;
    trackName?: string;
    trackIndex?: number;
  },
): ImportedCoaster {
  const heightValue =
    options.trackIndex === undefined ? fields.height : getTrackField(fields, "height", options.trackIndex);
  const speedValue =
    options.trackIndex === undefined ? fields.speed : getTrackField(fields, "speed", options.trackIndex);
  const lengthValue =
    options.trackIndex === undefined ? fields.length : getTrackField(fields, "length", options.trackIndex);
  const durationValue =
    options.trackIndex === undefined ? fields.duration : getTrackField(fields, "duration", options.trackIndex);
  const inversionsValue =
    options.trackIndex === undefined ? fields.inversions : getTrackField(fields, "inversions", options.trackIndex);

  return {
    source: COASTERPEDIA_SOURCE,
    sourceId:
      options.trackIndex === undefined || !options.trackName
        ? options.sourcePageId
        : buildTrackSourceId(options.sourcePageId, options.trackIndex, options.trackName),
    sourcePageId: options.sourcePageId,
    sourceUrl: options.sourceUrl,
    lastSyncedAt: Date.now(),
    name: formatCoasterName(options.parentName, options.trackName),
    parentName: options.parentName,
    park: options.park,
    location: options.location,
    type: deriveType(fields),
    isMultiTrack: options.isMultiTrack || undefined,
    multiTrackGroupId: options.isMultiTrack ? buildCoasterGroupId(options.sourcePageId) : undefined,
    trackName: options.trackName,
    trackIndex: options.trackIndex,
    manufacturer: cleanWikiText(fields.manufacturer || fields.builder) || undefined,
    product: cleanWikiText(fields.product) || undefined,
    propulsion: cleanWikiText(fields.propulsion ?? fields["lift/launch"]) || undefined,
    durationSeconds: parseDurationSeconds(durationValue),
    status: formatStatus(fields.status),
    heightFt: normalizeMeasurement(heightValue, options.measurementSystem, {
      metricPattern: /\b(?:m|meter|meters|metre|metres)\b/i,
      imperialPattern: /\b(?:ft|foot|feet)\b/i,
      convertMetric: (numericValue) => numericValue * METERS_TO_FEET,
    }),
    speedMph: normalizeMeasurement(speedValue, options.measurementSystem, {
      metricPattern: /\b(?:km\/h|kmh|kph|kilometer per hour|kilometers per hour|kilometre per hour|kilometres per hour)\b/i,
      imperialPattern: /\b(?:mph|mile per hour|miles per hour)\b/i,
      convertMetric: (numericValue) => numericValue * KMH_TO_MPH,
    }),
    lengthFt: normalizeMeasurement(lengthValue, options.measurementSystem, {
      metricPattern: /\b(?:m|meter|meters|metre|metres)\b/i,
      imperialPattern: /\b(?:ft|foot|feet)\b/i,
      convertMetric: (numericValue) => numericValue * METERS_TO_FEET,
    }),
    inversions: parseNumber(inversionsValue),
    yearOpened: extractYear(fields.opened),
    imageUrl: undefined,
  };
}

export function normalizeCoasterEntries(page: any): ImportedCoaster[] {
  const revision = page.revisions?.[0]?.slots?.main?.["*"];
  if (!revision) {
    throw new Error(`Missing revision content for ${page.title}`);
  }

  const { templateName, fields } = parseInfobox(revision);
  const park = cleanWikiText(fields.park);
  const location = normalizeLocation(fields);
  const measurementSystem = inferMeasurementSystem(fields.units);
  const sourcePageId = String(page.pageid);
  const sourceUrl = page.canonicalurl ?? page.fullurl;
  const parentName = cleanWikiText(fields.name) || page.title;
  const trackNames = getTrackNames(fields);
  const isMultiTrack = templateName === "coaster multitrack" && trackNames.length > 0;

  if (!isMultiTrack) {
    return [
      buildImportedCoaster(page, fields, {
        sourcePageId,
        sourceUrl,
        park,
        location,
        measurementSystem,
        parentName,
        isMultiTrack: false,
      }),
    ];
  }

  return trackNames.map((trackName, trackIndex) =>
    buildImportedCoaster(page, fields, {
      sourcePageId,
      sourceUrl,
      park,
      location,
      measurementSystem,
      parentName,
      isMultiTrack: true,
      trackName,
      trackIndex,
    }),
  );
}

export function normalizeCoaster(page: any): ImportedCoaster {
  const [coaster] = normalizeCoasterEntries(page);
  if (!coaster) {
    throw new Error(`Could not normalize coaster for ${page.title}`);
  }
  return coaster;
}

export function logCoasterpediaNormalizationFailure(
  context: string,
  page: { pageid?: string | number; title?: string } | null | undefined,
  error: unknown,
) {
  console.warn(`[${context}] Failed to normalize Coasterpedia page`, {
    title: page?.title ?? null,
    sourceId: page?.pageid !== undefined ? String(page.pageid) : null,
    error: error instanceof Error ? error.message : String(error),
  });
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

export async function fetchCoasterpediaPageByTitle(title: string) {
  const pages = await fetchCoasterpediaPages({ titles: title });
  return pages[0] ?? null;
}

function normalizeWikiPageTitle(title: string) {
  return title.replace(/_/g, " ").trim();
}

type WikiSection = {
  level: number;
  title: string;
  bodyStart: number;
  end: number;
};

function canonicalizeSectionTitle(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function getWikiSections(
  wikitext: string,
  options?: {
    startIndex?: number;
    endIndex?: number;
  },
) {
  const startIndex = options?.startIndex ?? 0;
  const endIndex = options?.endIndex ?? wikitext.length;
  const sections: WikiSection[] = [];
  const headingPattern = /^(={2,6})\s*(.*?)\s*\1\s*$/gm;

  for (const match of wikitext.matchAll(headingPattern)) {
    const matchIndex = match.index ?? -1;
    if (matchIndex < startIndex || matchIndex >= endIndex) {
      continue;
    }

    const marker = match[1] ?? "";
    const rawTitle = match[2] ?? "";
    sections.push({
      level: marker.length,
      title: cleanWikiText(rawTitle),
      bodyStart: matchIndex + match[0].length + 1,
      end: endIndex,
    });
  }

  for (let index = 0; index < sections.length; index += 1) {
    const current = sections[index];
    const next = sections
      .slice(index + 1)
      .find((section) => section.level <= current.level);
    current.end = next ? (wikitext.lastIndexOf("\n", next.bodyStart - 2) >= 0
      ? wikitext.lastIndexOf("\n", next.bodyStart - 2)
      : next.bodyStart - 1) : endIndex;
  }

  return sections;
}

function findWikiSection(
  wikitext: string,
  sectionTitle: string,
  options?: {
    startIndex?: number;
    endIndex?: number;
  },
) {
  const normalizedTitle = canonicalizeSectionTitle(sectionTitle);
  return getWikiSections(wikitext, options).find(
    (section) => canonicalizeSectionTitle(section.title) === normalizedTitle,
  );
}

function extractFirstWikiTable(sectionText: string) {
  const lines = sectionText.split("\n");
  const tableLines: string[] = [];
  let tableDepth = 0;
  let isCapturing = false;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!isCapturing) {
      if (!trimmed.startsWith("{|")) {
        continue;
      }
      isCapturing = true;
    }

    if (trimmed.startsWith("{|")) {
      tableDepth += 1;
    }

    tableLines.push(line);

    if (trimmed.startsWith("|}")) {
      tableDepth -= 1;
      if (tableDepth === 0) {
        return tableLines.join("\n");
      }
    }
  }

  return null;
}

function extractPresentCoasterTable(wikitext: string) {
  const presentSection = findWikiSection(wikitext, "Present");
  if (presentSection) {
    const rollerCoastersSection = findWikiSection(wikitext, "Roller coasters", {
      startIndex: presentSection.bodyStart,
      endIndex: presentSection.end,
    });
    if (rollerCoastersSection) {
      const table = extractFirstWikiTable(
        wikitext.slice(rollerCoastersSection.bodyStart, rollerCoastersSection.end),
      );
      if (table) return table;
    }
  }

  const rollerCoastersSection = findWikiSection(wikitext, "Roller coasters");
  if (!rollerCoastersSection) {
    return null;
  }

  const presentSubsection = findWikiSection(wikitext, "Present", {
    startIndex: rollerCoastersSection.bodyStart,
    endIndex: rollerCoastersSection.end,
  });
  if (presentSubsection) {
    const table = extractFirstWikiTable(
      wikitext.slice(presentSubsection.bodyStart, presentSubsection.end),
    );
    if (table) return table;
  }

  return extractFirstWikiTable(
    wikitext.slice(rollerCoastersSection.bodyStart, rollerCoastersSection.end),
  );
}

function extractLinkedPageTitle(value: string) {
  const match = value.match(/\[\[([^|\]#]+)(?:#[^|\]]*)?(?:\|[^\]]+)?\]\]/);
  if (!match?.[1]) return null;
  return normalizeWikiPageTitle(match[1]);
}

function extractPresentCoasterPageTitles(wikitext: string) {
  const table = extractPresentCoasterTable(wikitext);
  if (!table) return [];

  const pageTitles: string[] = [];
  const rows = table.split(/\n\|-\s*\n/g);
  for (const row of rows) {
    const rowText = row.trim();
    if (!rowText || rowText.startsWith("{|") || rowText.startsWith("!")) {
      continue;
    }

    const title = extractLinkedPageTitle(rowText);
    if (!title) continue;
    if (!pageTitles.includes(title)) {
      pageTitles.push(title);
    }
  }

  return pageTitles;
}

function chunkArray<T>(entries: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < entries.length; index += size) {
    chunks.push(entries.slice(index, index + size));
  }
  return chunks;
}

export async function fetchCoasterpediaParkLineup(parkName: string) {
  const requestedParkName = parkName.trim();
  if (!requestedParkName) {
    throw new Error("Park name is required");
  }

  const candidateTitles = Array.from(
    new Set([requestedParkName, ...(await searchCoasterpediaTitles(requestedParkName))]),
  );

  let matchedParkPage: any = null;
  let coasterPageTitles: string[] = [];
  for (const title of candidateTitles) {
    const page = await fetchCoasterpediaPageByTitle(title);
    const revision = page?.revisions?.[0]?.slots?.main?.["*"];
    if (!page || !revision) {
      continue;
    }

    const nextCoasterPageTitles = extractPresentCoasterPageTitles(revision);
    if (nextCoasterPageTitles.length === 0) {
      continue;
    }

    if (
      canonicalizeForImportMatch(page.title ?? "") === canonicalizeForImportMatch(requestedParkName) ||
      parkMatchesImport(page.title ?? "", requestedParkName)
    ) {
      matchedParkPage = page;
      coasterPageTitles = nextCoasterPageTitles;
      break;
    }

    if (!matchedParkPage) {
      matchedParkPage = page;
      coasterPageTitles = nextCoasterPageTitles;
    }
  }

  if (!matchedParkPage || coasterPageTitles.length === 0) {
    return null;
  }

  const coasterPages = (
    await Promise.all(
      chunkArray(coasterPageTitles, 20).map(async (titles) =>
        await fetchCoasterpediaPages({ titles: titles.join("|") }),
      ),
    )
  ).flat();

  const normalizedByPageTitle = new Map<string, ImportedCoaster[]>();
  for (const page of coasterPages) {
    try {
      normalizedByPageTitle.set(normalizeWikiPageTitle(page.title ?? ""), normalizeCoasterEntries(page));
    } catch (error) {
      logCoasterpediaNormalizationFailure("coasterpedia.fetchCoasterpediaParkLineup", page, error);
    }
  }

  const coasters = coasterPageTitles.flatMap(
    (pageTitle) => normalizedByPageTitle.get(normalizeWikiPageTitle(pageTitle)) ?? [],
  );

  return {
    park: matchedParkPage.title ?? requestedParkName,
    sourceUrl: matchedParkPage.canonicalurl ?? matchedParkPage.fullurl ?? undefined,
    coasters,
  };
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizePunctuation(value: string) {
  return value
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-");
}

function normalizeTrailingImportSuffix(value: string) {
  const match = value.match(/^(.*)\(([^()]+)\)$/);
  if (!match) return value;

  const prefix = normalizeWhitespace(match[1] ?? "");
  const suffix = normalizeWhitespace(match[2] ?? "");
  if (!prefix || !suffix) return value;

  if (/^[A-Z0-9]{2,8}$/.test(suffix)) {
    return prefix;
  }

  const variantMatch = suffix.match(/^([A-Z0-9]{2,8}),\s*(.+)$/);
  if (variantMatch?.[2]) {
    return `${prefix} (${normalizeWhitespace(variantMatch[2])})`;
  }

  return value;
}

function stripParkDisambiguatorFromCandidateName(name: string, park: string) {
  const match = name.match(/^(.*)\(([^()]+)\)$/);
  if (!match) return name;

  const prefix = normalizeWhitespace(match[1] ?? "");
  const suffix = normalizeWhitespace(match[2] ?? "");
  if (!prefix || !suffix) return name;

  if (canonicalizeForImportMatch(suffix) === canonicalizeForImportMatch(park)) {
    return prefix;
  }

  return name;
}

export function normalizeImportCoasterName(name: string) {
  const normalized = normalizeWhitespace(normalizePunctuation(name));
  return normalizeTrailingImportSuffix(normalized);
}

export function canonicalizeForImportMatch(value: string) {
  return normalizeWhitespace(normalizePunctuation(value))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]s\b/gi, "")
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/^the\s+/i, "")
    .trim();
}

export function coasterNameMatchesImport(name: string, park: string, importedName: string) {
  const normalizedImportedName = canonicalizeForImportMatch(normalizeImportCoasterName(importedName));
  if (!normalizedImportedName) return false;

  const candidateNames = [
    canonicalizeForImportMatch(name),
    canonicalizeForImportMatch(stripParkDisambiguatorFromCandidateName(name, park)),
  ];

  return candidateNames.includes(normalizedImportedName);
}

export function parkMatchesImport(park: string, importedPark: string) {
  const candidatePark = canonicalizeForImportMatch(park);
  const importedParkKey = canonicalizeForImportMatch(importedPark);

  return (
    candidatePark === importedParkKey ||
    candidatePark.replace(/\s+/g, "") === importedParkKey.replace(/\s+/g, "")
  );
}
