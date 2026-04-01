import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const COASTERPEDIA_SOURCE = "coasterpedia";
const COASTERPEDIA_API = "https://coasterpedia.net/w/api.php";

type ImportedCoaster = {
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
  const match = wikitext.match(/\{\{Infobox roller coaster([\s\S]*?)\n\}\}/i);
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

function normalizeCoaster(page: any): ImportedCoaster {
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
    heightFt: parseNumber(fields.height),
    speedMph: parseNumber(fields.speed),
    lengthFt: parseNumber(fields.length),
    inversions: parseNumber(fields.inversions),
    yearOpened: extractYear(fields.opened),
    imageUrl: undefined,
  };
}

async function fetchJson(url: string) {
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

function buildApiUrl(params: Record<string, string>) {
  const searchParams = new URLSearchParams({
    format: "json",
    ...params,
  });
  return `${COASTERPEDIA_API}?${searchParams.toString()}`;
}

export const search = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    if (!args.q.trim()) {
      return await ctx.db.query("coasters").order("asc").take(30);
    }
    return await ctx.db
      .query("coasters")
      .withSearchIndex("search_coasters", (q) => q.search("name", args.q))
      .take(20);
  },
});

export const searchCoasterpedia = action({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const queryText = args.q.trim();
    if (!queryText) return [];

    const searchResults = (await fetchJson(
      buildApiUrl({
        action: "opensearch",
        search: queryText,
        limit: "8",
        namespace: "0",
      }),
    )) as [string, string[], string[], string[]];

    const titles = searchResults[1] ?? [];
    if (titles.length === 0) return [];

    const details = await fetchJson(
      buildApiUrl({
        action: "query",
        prop: "info|revisions",
        inprop: "url",
        rvprop: "content",
        rvslots: "main",
        titles: titles.join("|"),
      }),
    );

    const pages = Object.values((details as any).query?.pages ?? {}) as any[];
    const normalized: ImportedCoaster[] = [];
    for (const page of pages) {
      try {
        normalized.push(normalizeCoaster(page));
      } catch {
        continue;
      }
    }

    const withLocalIds: ImportedCoaster[] = [];
    for (const coaster of normalized) {
      const existing: any = await ctx.runQuery(api.coasters.findBySourceId, {
        source: coaster.source,
        sourceId: coaster.sourceId,
      });
      withLocalIds.push({
        ...coaster,
        _id: existing?._id ?? undefined,
      });
    }

    return withLocalIds;
  },
});

export const materializeCoasterpediaCoaster = action({
  args: { sourceId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const existing: any = await ctx.runQuery(api.coasters.findBySourceId, {
      source: COASTERPEDIA_SOURCE,
      sourceId: args.sourceId,
    });
    if (existing) return existing._id;

    const details = await fetchJson(
      buildApiUrl({
        action: "query",
        pageids: args.sourceId,
        prop: "info|revisions",
        inprop: "url",
        rvprop: "content",
        rvslots: "main",
      }),
    );

    const page = (details as any).query?.pages?.[args.sourceId];
    if (!page) {
      throw new Error("Could not find coaster in Coasterpedia");
    }

    const coaster = normalizeCoaster(page);
    return await ctx.runMutation(internal.coasters.upsertImportedCoaster, coaster);
  },
});

export const get = query({
  args: { id: v.id("coasters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getMany = query({
  args: { ids: v.array(v.id("coasters")) },
  handler: async (ctx, args) => {
    const results = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return results.filter(Boolean);
  },
});

export const getTopCoasters = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("coasters").take(30);
  },
});

export const findBySourceId = query({
  args: {
    source: v.string(),
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("coasters")
      .withIndex("by_source_and_sourceId", (q) =>
        q.eq("source", args.source).eq("sourceId", args.sourceId)
      )
      .unique();
  },
});

export const upsertImportedCoaster = internalMutation({
  args: {
    source: v.string(),
    sourceId: v.string(),
    sourceUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
    name: v.string(),
    park: v.string(),
    location: v.string(),
    type: v.string(),
    manufacturer: v.optional(v.string()),
    heightFt: v.optional(v.number()),
    speedMph: v.optional(v.number()),
    lengthFt: v.optional(v.number()),
    inversions: v.optional(v.number()),
    yearOpened: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coasters")
      .withIndex("by_source_and_sourceId", (q) =>
        q.eq("source", args.source).eq("sourceId", args.sourceId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("coasters", args);
  },
});
