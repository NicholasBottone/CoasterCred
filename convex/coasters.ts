import { action, internalMutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { computeRankingScore } from "./rankings";
import {
  COASTERPEDIA_SOURCE,
  fetchCoasterpediaPageById,
  fetchCoasterpediaPages,
  normalizeCoaster,
  searchCoasterpediaTitles,
  type ImportedCoaster,
} from "./coasterpedia";
import {
  getCoasterStatsDoc,
  getUserCoasterStatsDoc,
  getTrendingCoasterIds,
} from "./usageStats";

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

    const [coasterStats, myStats, myRanking, myAllRankings] = await Promise.all([
      getCoasterStatsDoc(ctx, localCoaster._id),
      getUserCoasterStatsDoc(ctx, viewerUserId, localCoaster._id),
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
          myRanking && myAllRankings.length > 0
            ? computeRankingScore(myRanking.rank, myAllRankings.length)
            : null,
      },
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
        const [stat, user, profile, ranking, allRankings] = await Promise.all([
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
          ctx.db
            .query("rankings")
            .withIndex("by_user_and_rank", (q) => q.eq("userId", follow.followingId))
            .collect(),
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
            ranking && allRankings.length > 0
              ? computeRankingScore(ranking.rank, allRankings.length)
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
