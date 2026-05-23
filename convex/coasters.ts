import { action, internalMutation, query, type ActionCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { computeRankingScore } from "./rankings";
import {
  coasterNameMatchesImport,
  COASTERPEDIA_SOURCE,
  fetchCoasterpediaPageById,
  fetchCoasterpediaPages,
  normalizeCoaster,
  normalizeImportCoasterName,
  parkMatchesImport,
  searchCoasterpediaTitles,
  type ImportedCoaster,
} from "./coasterpedia";
import {
  getCoasterStatsDoc,
  getUserRankingStatsDoc,
  getUserCoasterStatsDoc,
  getTrendingCoasterIds,
} from "./usageStats";

type ImportedCoasterMatchCandidate = ImportedCoaster & {
  _id?: string;
  nameMatches: boolean;
  parkMatches: boolean;
};

async function attachLocalIds(
  ctx: ActionCtx,
  coasters: ImportedCoaster[],
): Promise<ImportedCoaster[]> {
  const existingEntries = await Promise.all(
    coasters.map(async (coaster) => {
      const existing = await ctx.runQuery(api.coasters.findBySourceId, {
        source: coaster.source,
        sourceId: coaster.sourceId,
      });
      return [coaster.sourceId, existing?._id ?? undefined] as const;
    }),
  );

  const localIdBySourceId = new Map(existingEntries);
  return coasters.map((coaster) => ({
    ...coaster,
    _id: localIdBySourceId.get(coaster.sourceId),
  }));
}

function scoreImportCandidate(candidate: ImportedCoasterMatchCandidate) {
  if (candidate.nameMatches && candidate.parkMatches) return 4;
  if (candidate.nameMatches) return 3;
  if (candidate.parkMatches) return 2;
  return 1;
}

async function loadSearchTitlesForImport(name: string, park: string) {
  const queryTexts = Array.from(
    new Set(
      [`${name} ${park}`.trim(), name, `${name.split("(")[0]?.trim() ?? ""} ${park}`.trim()].filter(Boolean),
    ),
  );

  const titles = new Set<string>();
  for (const queryText of queryTexts) {
    const nextTitles = await searchCoasterpediaTitles(queryText);
    for (const title of nextTitles) {
      titles.add(title);
      if (titles.size >= 12) {
        return Array.from(titles);
      }
    }
  }

  return Array.from(titles);
}

export const searchCoasterpedia = action({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const queryText = args.q.trim();
    if (!queryText) return [];

    let titles: string[];
    try {
      titles = await searchCoasterpediaTitles(queryText);
    } catch {
      throw new ConvexError("Could not search coasters right now");
    }

    if (titles.length === 0) return [];

    let pages: any[];
    try {
      pages = await fetchCoasterpediaPages({ titles: titles.join("|") });
    } catch {
      throw new ConvexError("Could not load coaster details right now");
    }

    const normalized: ImportedCoaster[] = [];
    for (const page of pages) {
      try {
        normalized.push(normalizeCoaster(page));
      } catch {
        continue;
      }
    }

    return await attachLocalIds(ctx, normalized);
  },
});

export const validateRankingImportRow = action({
  args: {
    name: v.string(),
    park: v.string(),
  },
  handler: async (ctx, args) => {
    const importedName = normalizeImportCoasterName(args.name);
    const importedPark = args.park.trim();

    if (!importedName || !importedPark) {
      throw new ConvexError("Coaster name and park are required");
    }

    let titles: string[];
    try {
      titles = await loadSearchTitlesForImport(importedName, importedPark);
    } catch {
      throw new ConvexError("Could not validate this coaster against Coasterpedia right now");
    }

    if (titles.length === 0) {
      return {
        normalizedName: importedName,
        exactMatch: null,
        candidates: [],
        issue: {
          code: "not_found",
          message: "No Coasterpedia matches were found for this coaster name.",
          fieldNames: ["name"],
        },
      };
    }

    let pages: any[];
    try {
      pages = await fetchCoasterpediaPages({ titles: titles.join("|") });
    } catch {
      throw new ConvexError("Could not load coaster details from Coasterpedia right now");
    }

    const normalized: ImportedCoaster[] = [];
    for (const page of pages) {
      try {
        normalized.push(normalizeCoaster(page));
      } catch {
        continue;
      }
    }

    const withLocalIds = await attachLocalIds(ctx, normalized);
    const candidates: ImportedCoasterMatchCandidate[] = withLocalIds
      .map((candidate) => ({
        ...candidate,
        nameMatches: coasterNameMatchesImport(candidate.name, candidate.park, importedName),
        parkMatches: parkMatchesImport(candidate.park, importedPark),
      }))
      .sort((a, b) => {
        const scoreDifference = scoreImportCandidate(b) - scoreImportCandidate(a);
        if (scoreDifference !== 0) return scoreDifference;
        return a.name.localeCompare(b.name);
      });

    const exactMatch =
      candidates.find((candidate) => candidate.nameMatches && candidate.parkMatches) ?? null;

    if (exactMatch) {
      return {
        normalizedName: importedName,
        exactMatch,
        candidates,
        issue: null,
      };
    }

    const hasNameMatch = candidates.some((candidate) => candidate.nameMatches);
    const hasParkMatch = candidates.some((candidate) => candidate.parkMatches);
    const issue = hasNameMatch
      ? {
          code: "park_mismatch",
          message: "A coaster with this name was found, but the park does not match Coasterpedia exactly.",
          fieldNames: ["park"],
        }
      : hasParkMatch
        ? {
            code: "name_mismatch",
            message: "Found coasters at this park, but none matched the coaster name exactly.",
            fieldNames: ["name"],
          }
        : {
            code: "no_exact_match",
            message: "Found nearby Coasterpedia results, but none matched both name and park exactly.",
            fieldNames: ["name", "park"],
          };

    return {
      normalizedName: importedName,
      exactMatch: null,
      candidates,
      issue,
    };
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

    let page: any;
    try {
      page = await fetchCoasterpediaPageById(args.sourceId);
    } catch {
      throw new ConvexError("Could not load this coaster right now");
    }

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
    if (!viewerUserId) {
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
        },
      };
    }

    if (!localCoaster) {
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
        },
      };
    }

    const [coasterStats, myStats, myRanking, myRankingStats] = await Promise.all([
      getCoasterStatsDoc(ctx, localCoaster._id),
      getUserCoasterStatsDoc(ctx, viewerUserId, localCoaster._id),
      ctx.db
        .query("rankings")
        .withIndex("by_user_and_coaster", (q) =>
          q.eq("userId", viewerUserId).eq("coasterId", localCoaster._id)
        )
        .unique(),
      getUserRankingStatsDoc(ctx, viewerUserId),
    ]);

    return {
      localCoaster,
      appStats: {
        uniqueRiderCount: coasterStats?.uniqueRiderCount ?? 0,
        totalLogCount: coasterStats?.totalLogCount ?? 0,
      },
      myStats: {
        hasRidden: (myStats?.rideCount ?? 0) > 0,
        rideCount: myStats?.rideCount ?? 0,
        currentRank: myRanking?.rank ?? null,
        currentScore:
          myRanking && typeof myRankingStats?.rankingCount === "number" && myRankingStats.rankingCount > 0
            ? computeRankingScore(myRanking.rank, myRankingStats.rankingCount)
            : null,
      },
    };
  },
});

export const getCoasterFriendSummary = query({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const viewerUserId = await getAuthUserId(ctx);
    if (!viewerUserId) {
      return {
        followedRiderCount: 0,
        averageFollowedScore: null,
        latestFollowedRideAt: null,
        latestFollowedRideDate: null,
      };
    }

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", viewerUserId))
      .collect();
    if (follows.length === 0) {
      return {
        followedRiderCount: 0,
        averageFollowedScore: null,
        latestFollowedRideAt: null,
        latestFollowedRideDate: null,
      };
    }

    const entries = await Promise.all(
      follows.map(async (follow) => {
        const [stat, ranking, rankingStats] = await Promise.all([
          getUserCoasterStatsDoc(ctx, follow.followingId, args.coasterId),
          ctx.db
            .query("rankings")
            .withIndex("by_user_and_coaster", (q) =>
              q.eq("userId", follow.followingId).eq("coasterId", args.coasterId),
            )
            .unique(),
          getUserRankingStatsDoc(ctx, follow.followingId),
        ]);

        if (!stat) return null;

        return {
          latestRideAt: stat.latestRiddenAt,
          latestRideDate: stat.latestRideDate ?? null,
          score:
            ranking && typeof rankingStats?.rankingCount === "number" && rankingStats.rankingCount > 0
              ? computeRankingScore(ranking.rank, rankingStats.rankingCount)
              : null,
        };
      }),
    );

    const followedEntries = entries.filter((entry) => entry !== null);
    const latestEntry = followedEntries.reduce<null | (typeof followedEntries)[number]>(
      (latest, entry) => {
        if (!entry) return latest;
        if (!latest || (entry.latestRideAt ?? 0) > (latest.latestRideAt ?? 0)) {
          return entry;
        }
        return latest;
      },
      null,
    );
    const scoredEntries = followedEntries.filter((entry) => typeof entry?.score === "number");

    return {
      followedRiderCount: followedEntries.length,
      averageFollowedScore:
        scoredEntries.length > 0
          ? Math.round(
              (scoredEntries.reduce((sum, entry) => sum + (entry?.score ?? 0), 0) / scoredEntries.length) *
                10,
            ) / 10
          : null,
      latestFollowedRideAt: latestEntry?.latestRideAt ?? null,
      latestFollowedRideDate: latestEntry?.latestRideDate ?? null,
    };
  },
});

export const getCoasterFollowedRiders = query({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const viewerUserId = await getAuthUserId(ctx);
    if (!viewerUserId) return [];

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", viewerUserId))
      .collect();
    if (follows.length === 0) return [];

    const entries = await Promise.all(
      follows.map(async (follow) => {
        const [stat, user, profile, ranking, rankingStats] = await Promise.all([
          getUserCoasterStatsDoc(ctx, follow.followingId, args.coasterId),
          ctx.db.get(follow.followingId),
          ctx.db
            .query("userProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", follow.followingId))
            .unique(),
          ctx.db
            .query("rankings")
            .withIndex("by_user_and_coaster", (q) =>
              q.eq("userId", follow.followingId).eq("coasterId", args.coasterId),
            )
            .unique(),
          getUserRankingStatsDoc(ctx, follow.followingId),
        ]);

        if (!stat || !user) return null;

        return {
          user: {
            _id: user._id,
            name: user.name,
          },
          profile,
          rideCount: stat.rideCount,
          lastRideAt: stat.latestRiddenAt,
          lastRideDate: stat.latestRideDate ?? null,
          rank: ranking?.rank ?? null,
          score:
            ranking && typeof rankingStats?.rankingCount === "number" && rankingStats.rankingCount > 0
              ? computeRankingScore(ranking.rank, rankingStats.rankingCount)
              : null,
        };
      }),
    );

    return entries
      .filter((entry) => entry !== null)
      .sort((a, b) => {
        if ((b?.lastRideAt ?? 0) !== (a?.lastRideAt ?? 0)) {
          return (b?.lastRideAt ?? 0) - (a?.lastRideAt ?? 0);
        }
        return (a?.user?.name ?? "").localeCompare(b?.user?.name ?? "");
      });
  },
});

export const getTopCoasters = query({
  args: {},
  handler: async (ctx) => {
    const coasterIds = await getTrendingCoasterIds(ctx);
    const coasterDocs = await Promise.all(coasterIds.map(async (coasterId) => await ctx.db.get(coasterId)));
    return coasterDocs.filter((coaster) => coaster !== null);
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
