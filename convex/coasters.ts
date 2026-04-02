import { action, internalMutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { computeRankingScore } from "./rankings";

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

    let searchResults: [string, string[], string[], string[]];
    try {
      searchResults = (await fetchJson(
        buildApiUrl({
          action: "opensearch",
          search: queryText,
          limit: "8",
          namespace: "0",
        }),
      )) as [string, string[], string[], string[]];
    } catch {
      throw new ConvexError("Could not search coasters right now");
    }

    const titles = searchResults[1] ?? [];
    if (titles.length === 0) return [];

    let details: unknown;
    try {
      details = await fetchJson(
        buildApiUrl({
          action: "query",
          prop: "info|revisions",
          inprop: "url",
          rvprop: "content",
          rvslots: "main",
          titles: titles.join("|"),
        }),
      );
    } catch {
      throw new ConvexError("Could not load coaster details right now");
    }

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

    let details: unknown;
    try {
      details = await fetchJson(
        buildApiUrl({
          action: "query",
          pageids: args.sourceId,
          prop: "info|revisions",
          inprop: "url",
          rvprop: "content",
          rvslots: "main",
        }),
      );
    } catch {
      throw new ConvexError("Could not load this coaster right now");
    }

    const page = (details as any).query?.pages?.[args.sourceId];
    if (!page) {
      throw new ConvexError("Could not find this coaster");
    }

    let coaster: ImportedCoaster;
    try {
      coaster = normalizeCoaster(page);
    } catch {
      throw new ConvexError("Could not load this coaster");
    }
    return await ctx.runMutation(internal.coasters.upsertImportedCoaster, coaster);
  },
});

export const getCoasterProfile = query({
  args: {
    coasterId: v.optional(v.id("coasters")),
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let localCoaster =
      args.coasterId !== undefined ? await ctx.db.get(args.coasterId) : null;

    if (!localCoaster && args.source && args.sourceId) {
      localCoaster = await ctx.db
        .query("coasters")
        .withIndex("by_source_and_sourceId", (q) =>
          q.eq("source", args.source!).eq("sourceId", args.sourceId!)
        )
        .unique();
    }

    const viewerUserId = await getAuthUserId(ctx);
    if (!localCoaster || !viewerUserId) {
      return {
        localCoaster,
        appStats: {
          uniqueRiderCount: 0,
          totalLogCount: 0,
        },
        myStats: {
          hasRidden: false,
          rideCount: 0,
          currentRank: null,
          currentScore: null,
          rideHistory: [],
        },
        followedRiders: [],
        followedRiderCount: 0,
        averageFollowedRiderScore: null,
      };
    }

    const [coasterLogs, myLogs, myRanking, myAllRankings, follows] = await Promise.all([
      ctx.db
        .query("rideLogs")
        .withIndex("by_coaster", (q) => q.eq("coasterId", localCoaster._id))
        .collect(),
      ctx.db
        .query("rideLogs")
        .withIndex("by_user_and_coaster", (q) =>
          q.eq("userId", viewerUserId).eq("coasterId", localCoaster._id)
        )
        .collect(),
      ctx.db
        .query("rankings")
        .withIndex("by_user_and_coaster", (q) =>
          q.eq("userId", viewerUserId).eq("coasterId", localCoaster._id)
        )
        .unique(),
      ctx.db
        .query("rankings")
        .withIndex("by_user_and_rank", (q) => q.eq("userId", viewerUserId))
        .collect(),
      ctx.db
        .query("follows")
        .withIndex("by_follower", (q) => q.eq("followerId", viewerUserId))
        .collect(),
    ]);

    const followingIds = follows.map((follow) => follow.followingId);
    const followingSet = new Set(followingIds.map((id) => String(id)));
    const uniqueRiderCount = new Set(coasterLogs.map((log) => String(log.userId))).size;
    const totalLogCount = coasterLogs.length;

    const logsByUser = new Map<string, any[]>();
    for (const log of coasterLogs) {
      const key = String(log.userId);
      const nextLogs = logsByUser.get(key) ?? [];
      nextLogs.push(log);
      logsByUser.set(key, nextLogs);
    }

    const followedRiderEntries = await Promise.all(
      [...logsByUser.entries()]
        .filter(([userId]) => followingSet.has(userId))
        .map(async ([rawUserId, logs]) => {
          const friendUserId = rawUserId as Id<"users">;
          const [user, profile, ranking, allRankings] = await Promise.all([
            ctx.db.get(friendUserId),
            ctx.db
              .query("userProfiles")
              .withIndex("by_userId", (q) => q.eq("userId", friendUserId))
              .unique(),
            ctx.db
              .query("rankings")
              .withIndex("by_user_and_coaster", (q) =>
                q.eq("userId", friendUserId).eq("coasterId", localCoaster._id)
              )
              .unique(),
            ctx.db
              .query("rankings")
              .withIndex("by_user_and_rank", (q) => q.eq("userId", friendUserId))
              .collect(),
          ]);

          if (!user) {
            return null;
          }

          const lastRideAt = logs.reduce(
            (latest, log) => Math.max(latest, log.riddenAt),
            0,
          );
          const lastRideLog =
            logs.slice().sort((a, b) => b.riddenAt - a.riddenAt)[0] ?? null;

          return {
            user: {
              _id: user._id,
              name: user.name,
            },
            profile,
            rideCount: logs.length,
            lastRideAt: lastRideAt || null,
            lastRideDate: lastRideLog?.rideDate ?? null,
            rank: ranking?.rank ?? null,
            score:
              ranking && allRankings.length > 0
                ? computeRankingScore(ranking.rank, allRankings.length)
                : null,
          };
        }),
    );

    const followedRiders = followedRiderEntries
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const scoreA = a?.score ?? -1;
        const scoreB = b?.score ?? -1;
        if (scoreB !== scoreA) return scoreB - scoreA;
        if ((b?.lastRideAt ?? 0) !== (a?.lastRideAt ?? 0)) {
          return (b?.lastRideAt ?? 0) - (a?.lastRideAt ?? 0);
        }
        return (a?.user?.name ?? "").localeCompare(b?.user?.name ?? "");
      });

    const rankedFollowedRiders = followedRiders.filter((entry: any) => typeof entry.score === "number");
    const averageFollowedRiderScore =
      rankedFollowedRiders.length > 0
        ? Math.round(
            (rankedFollowedRiders.reduce((sum: number, entry: any) => sum + entry.score, 0) /
              rankedFollowedRiders.length) *
              10,
          ) / 10
        : null;

    return {
      localCoaster,
      appStats: {
        uniqueRiderCount,
        totalLogCount,
      },
      myStats: {
        hasRidden: myLogs.length > 0,
        rideCount: myLogs.length,
        currentRank: myRanking?.rank ?? null,
        currentScore:
          myRanking && myAllRankings.length > 0
            ? computeRankingScore(myRanking.rank, myAllRankings.length)
            : null,
        rideHistory: myLogs.sort((a, b) => b.riddenAt - a.riddenAt),
      },
      followedRiders,
      followedRiderCount: followedRiders.length,
      averageFollowedRiderScore,
    };
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
    const coasters = await ctx.db.query("coasters").collect();
    const rideLogs = await ctx.db.query("rideLogs").collect();

    const rideCountByCoaster = new Map<string, number>();
    for (const log of rideLogs) {
      const key = String(log.coasterId);
      rideCountByCoaster.set(key, (rideCountByCoaster.get(key) ?? 0) + 1);
    }

    return coasters
      .sort((a, b) => {
        const countDiff =
          (rideCountByCoaster.get(String(b._id)) ?? 0) -
          (rideCountByCoaster.get(String(a._id)) ?? 0);
        if (countDiff !== 0) return countDiff;
        return a.name.localeCompare(b.name);
      })
      .slice(0, 30);
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
    product: v.optional(v.string()),
    propulsion: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    status: v.optional(v.string()),
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
