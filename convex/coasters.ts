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
          currentScore: null,
          rideHistory: [],
        },
        myRankings: [],
        followedRiders: [],
        followedRiderCount: 0,
        averageFollowedRiderScore: null,
      };
    }

    const myAllRankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q) => q.eq("userId", viewerUserId))
      .collect();
    const myRankingCoasterIds = [...new Set(myAllRankings.map((ranking) => String(ranking.coasterId)))];
    const myRankingCoasterEntries = await Promise.all(
      myRankingCoasterIds.map(async (coasterId) => [
        coasterId,
        await ctx.db.get(coasterId as Id<"coasters">),
      ] as const),
    );
    const myRankingCoasterMap = new Map(myRankingCoasterEntries);

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
          currentScore: null,
          rideHistory: [],
        },
        myRankings: myAllRankings.map((ranking) => ({
          ...ranking,
          coaster: myRankingCoasterMap.get(String(ranking.coasterId)) ?? null,
          score: computeRankingScore(ranking.rank, myAllRankings.length),
        })),
        followedRiders: [],
        followedRiderCount: 0,
        averageFollowedRiderScore: null,
      };
    }

    const [coasterLogs, myLogs, myRanking, follows] = await Promise.all([
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
      myRankings: myAllRankings.map((ranking) => ({
        ...ranking,
        coaster: myRankingCoasterMap.get(String(ranking.coasterId)) ?? null,
        score: computeRankingScore(ranking.rank, myAllRankings.length),
      })),
      followedRiders,
      followedRiderCount: followedRiders.length,
      averageFollowedRiderScore,
    };
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
