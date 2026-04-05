import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { computeRankingScore } from "./rankings";
import { getUserRankingStatsDoc, upsertUserRankingStats } from "./usageStats";

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

export const removeLog = mutation({
  args: { logId: v.id("rideLogs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== userId) throw new ConvexError("Ride log not found");

    await ctx.db.delete(log._id);
    await ctx.runMutation(internal.usageStats.refreshDerivedStatsForRide, {
      userId,
      coasterId: log.coasterId,
    });

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

      await upsertUserRankingStats(ctx, userId);
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
    const coasterIds = [...new Set(logs.map((log) => String(log.coasterId)))];
    const coasterEntries = await Promise.all(
      coasterIds.map(async (coasterId) => [coasterId, await ctx.db.get(coasterId as Id<"coasters">)] as const),
    );
    const coasterMap = new Map(coasterEntries);
    return logs.map((log) => ({
      ...log,
      coaster: coasterMap.get(String(log.coasterId)) ?? null,
    }));
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
    const coasterIds = [...new Set(logs.map((log) => String(log.coasterId)))];
    const coasterEntries = await Promise.all(
      coasterIds.map(async (coasterId) => [coasterId, await ctx.db.get(coasterId as Id<"coasters">)] as const),
    );
    const coasterMap = new Map(coasterEntries);
    return logs.map((log) => ({
      ...log,
      coaster: coasterMap.get(String(log.coasterId)) ?? null,
    }));
  },
});

export const getMyRideCountsForCoasters = query({
  args: { coasterIds: v.array(v.id("coasters")) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId || args.coasterIds.length === 0) return {};

    const counts: Record<string, number> = {};
    const stats = await Promise.all(
      args.coasterIds.map(async (coasterId) =>
        await ctx.db
          .query("userCoasterStats")
          .withIndex("by_user_and_coaster", (q) =>
            q.eq("userId", userId).eq("coasterId", coasterId),
          )
          .unique(),
      ),
    );

    for (const stat of stats) {
      if (!stat) continue;
      counts[String(stat.coasterId)] = stat.rideCount;
    }

    return counts;
  },
});

export const getMyLogsForCoaster = query({
  args: {
    coasterId: v.id("coasters"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const logs = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", args.coasterId)
      )
      .collect();

    const sorted = logs.sort((a, b) => b.riddenAt - a.riddenAt);
    const limit = Math.max(1, Math.min(args.limit ?? 10, 100));
    return sorted.slice(0, limit);
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
    const uniquePairKeys = [...new Set(candidateLogs.map((log) => `${String(log.userId)}:${String(log.coasterId)}`))];

    const userEntries = await Promise.all(
      uniqueUserIds.map(async (id) => {
        const nextUserId = id as Id<"users">;
        const [user, profile, rankingCount] = await Promise.all([
          ctx.db.get(nextUserId),
          ctx.db
            .query("userProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", nextUserId))
            .unique(),
          getUserRankingStatsDoc(ctx, nextUserId),
        ]);
        return [id, { user, profile, rankingCount: rankingCount?.rankingCount ?? 0 }] as const;
      })
    );
    const userMap = new Map(userEntries);

    const coasterEntries = await Promise.all(
      uniqueCoasterIds.map(async (id) => [id, await ctx.db.get(id as Id<"coasters">)] as const)
    );
    const coasterMap = new Map(coasterEntries);

    const pairEntries = await Promise.all(
      uniquePairKeys.map(async (key) => {
        const [rawUserId, rawCoasterId] = key.split(":");
        const [stat, ranking] = await Promise.all([
          ctx.db
            .query("userCoasterStats")
            .withIndex("by_user_and_coaster", (q) =>
              q
                .eq("userId", rawUserId as Id<"users">)
                .eq("coasterId", rawCoasterId as Id<"coasters">),
            )
            .unique(),
          ctx.db
            .query("rankings")
            .withIndex("by_user_and_coaster", (q) =>
              q
                .eq("userId", rawUserId as Id<"users">)
                .eq("coasterId", rawCoasterId as Id<"coasters">),
            )
            .unique(),
        ]);
        return [key, { stat, ranking }] as const;
      }),
    );
    const pairMap = new Map(pairEntries);

    return candidateLogs.map((log) => {
      const userData = userMap.get(String(log.userId));
      const coaster = coasterMap.get(String(log.coasterId)) ?? null;
      const pairKey = `${String(log.userId)}:${String(log.coasterId)}`;
      const pairData = pairMap.get(pairKey);
      const isFirstRide = pairData?.stat?.firstRiddenAt === log.riddenAt;

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
        rideOrdinal: isFirstRide ? 1 : null,
        isFirstRide,
        rank: pairData?.ranking?.rank ?? null,
        score:
          pairData?.ranking && typeof userData?.rankingCount === "number" && userData.rankingCount > 0
            ? computeRankingScore(pairData.ranking.rank, userData.rankingCount)
            : null,
      };
    });
  },
});
