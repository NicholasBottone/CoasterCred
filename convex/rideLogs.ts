import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { computeRankingScore } from "./rankings";

const FEED_LIMIT = 50;
const FEED_SCAN_LIMIT = 250;

async function getExistingLogForRideDate(
  ctx: any,
  userId: Id<"users">,
  coasterId: Id<"coasters">,
  rideDate: string,
) {
  return await ctx.db
    .query("rideLogs")
    .withIndex("by_user_and_coaster_and_rideDate", (q: any) =>
      q.eq("userId", userId).eq("coasterId", coasterId).eq("rideDate", rideDate)
    )
    .unique();
}

export const logRide = mutation({
  args: {
    coasterId: v.id("coasters"),
    riddenAt: v.number(),
    rideDate: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const existingForDay = await getExistingLogForRideDate(
      ctx,
      userId,
      args.coasterId,
      args.rideDate,
    );
    if (existingForDay) {
      throw new ConvexError("You already logged this coaster for that date");
    }

    const logId = await ctx.db.insert("rideLogs", {
      userId,
      coasterId: args.coasterId,
      riddenAt: args.riddenAt,
      rideDate: args.rideDate,
      notes: args.notes,
    });

    // Auto-add to ranking at the end
    const existingRankings = await ctx.db
      .query("rankings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const alreadyRanked = existingRankings.find(
      (r) => r.coasterId === args.coasterId
    );
    if (!alreadyRanked) {
      const maxRank = existingRankings.reduce(
        (max, r) => Math.max(max, r.rank),
        0
      );
      await ctx.db.insert("rankings", {
        userId,
        coasterId: args.coasterId,
        rank: maxRank + 1,
      });
    }

    return logId;
  },
});

export const removeLog = mutation({
  args: { logId: v.id("rideLogs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== userId) throw new ConvexError("Ride log not found");

    await ctx.db.delete(log._id);

    const remainingLogs = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", log.coasterId)
      )
      .collect();

    const ranking = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", log.coasterId)
      )
      .unique();
    if (ranking && remainingLogs.length === 0) {
      const trailingRankings = await ctx.db
        .query("rankings")
        .withIndex("by_user_and_rank", (q) => q.eq("userId", userId))
        .collect();

      await ctx.db.delete(ranking._id);

      for (const other of trailingRankings) {
        if (other._id !== ranking._id && other.rank > ranking.rank) {
          await ctx.db.patch(other._id, { rank: other.rank - 1 });
        }
      }
    }
  },
});

export const getMyLogs = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const logs = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_riddenAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const withCoasters = await Promise.all(
      logs.map(async (log) => {
        const coaster = await ctx.db.get(log.coasterId);
        return { ...log, coaster };
      })
    );
    return withCoasters;
  },
});

export const getUserLogs = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_riddenAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    const withCoasters = await Promise.all(
      logs.map(async (log) => {
        const coaster = await ctx.db.get(log.coasterId);
        return { ...log, coaster };
      })
    );
    return withCoasters;
  },
});

export const getMyLogsForCoaster = query({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const logs = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", args.coasterId)
      )
      .collect();

    return logs.sort((a, b) => b.riddenAt - a.riddenAt);
  },
});

export const getFeed = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .collect();

    const followingIds: Id<"users">[] = [
      userId,
      ...follows.map((f) => f.followingId),
    ];
    const followingSet = new Set(followingIds.map((id) => String(id)));
    const recentLogs = await ctx.db.query("rideLogs").order("desc").take(FEED_SCAN_LIMIT);

    const candidateLogs = [];
    for (const log of recentLogs) {
      if (!followingSet.has(String(log.userId))) continue;
      candidateLogs.push(log);
      if (candidateLogs.length >= FEED_LIMIT) break;
    }

    const uniqueUserIds = [...new Set(candidateLogs.map((log) => String(log.userId)))];
    const uniqueCoasterIds = [...new Set(candidateLogs.map((log) => String(log.coasterId)))];
    const uniquePairKeys = [
      ...new Set(candidateLogs.map((log) => `${String(log.userId)}:${String(log.coasterId)}`)),
    ];

    const userEntries = await Promise.all(
      uniqueUserIds.map(async (id) => {
        const nextUserId = id as Id<"users">;
        const user = await ctx.db.get(nextUserId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", nextUserId))
          .unique();
        const rankings = await ctx.db
          .query("rankings")
          .withIndex("by_user_and_rank", (q) => q.eq("userId", nextUserId))
          .collect();
        return [id, { user, profile, rankings }] as const;
      })
    );
    const userMap = new Map(userEntries);

    const coasterEntries = await Promise.all(
      uniqueCoasterIds.map(async (id) => [id, await ctx.db.get(id as Id<"coasters">)] as const)
    );
    const coasterMap = new Map(coasterEntries);

    const pairHistoryEntries = await Promise.all(
      uniquePairKeys.map(async (key) => {
        const [rawUserId, rawCoasterId] = key.split(":");
        const logs = await ctx.db
          .query("rideLogs")
          .withIndex("by_user_and_coaster", (q) =>
            q.eq("userId", rawUserId as Id<"users">).eq("coasterId", rawCoasterId as Id<"coasters">)
          )
          .collect();
        return [key, logs] as const;
      })
    );
    const pairHistoryMap = new Map(pairHistoryEntries);

    return candidateLogs.map((log) => {
      const userData = userMap.get(String(log.userId));
      const coaster = coasterMap.get(String(log.coasterId)) ?? null;
      const pairKey = `${String(log.userId)}:${String(log.coasterId)}`;
      const pairHistory = pairHistoryMap.get(pairKey) ?? [];
      const rideOrdinal = pairHistory.filter((historyLog) => historyLog.riddenAt <= log.riddenAt).length;
      const rankings = userData?.rankings ?? [];
      const currentRanking = rankings.find((ranking) => ranking.coasterId === log.coasterId);

      return {
        ...log,
        coaster,
        user: userData?.user
          ? {
              _id: userData.user._id,
              name: userData.user.name,
            }
          : null,
        profile: userData?.profile ?? null,
        rideOrdinal,
        isFirstRide: rideOrdinal === 1,
        score: currentRanking ? computeRankingScore(currentRanking.rank, rankings.length) : null,
      };
    });
  },
});
