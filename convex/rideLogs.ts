import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { feedGroupKey, feedRideDate, groupFeedLogs, type FeedLog } from "./feedGrouping";
import { getUserRankingStatsDoc, upsertUserRankingStats } from "./usageStats";
import { LIMITS, validateOptionalText } from "./validation";
import { isHistoricalRideDate } from "./feedEvents";

const FEED_LIMIT = 50;
const FEED_GROUP_LIMIT = 20;

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

export const updateLog = mutation({
  args: {
    logId: v.id("rideLogs"),
    rideDate: v.string(),
    riddenAt: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const log = await ctx.db.get(args.logId);
    if (!log || log.userId !== userId) throw new ConvexError("Ride log not found");

    let notes: string | undefined;
    try {
      notes = validateOptionalText(args.notes, "Notes", LIMITS.notes);
    } catch (error) {
      if (error instanceof Error) {
        throw new ConvexError(error.message);
      }
      throw new ConvexError("Could not update ride");
    }

    const existingForDay = await getExistingLogForRideDate(
      ctx,
      userId,
      log.coasterId,
      args.rideDate,
    );
    if (existingForDay && existingForDay._id !== log._id) {
      throw new ConvexError("You already logged this coaster for that date");
    }

    const rideTimingChanged = log.rideDate !== args.rideDate || log.riddenAt !== args.riddenAt;
    const nextIsFeedEvent = !isHistoricalRideDate(args.rideDate, log._creationTime);

    await ctx.db.patch(log._id, {
      rideDate: args.rideDate,
      riddenAt: args.riddenAt,
      notes,
      isFeedEvent: nextIsFeedEvent,
    });

    if (rideTimingChanged) {
      await ctx.runMutation(internal.usageStats.refreshDerivedStatsForRide, {
        userId,
        coasterId: log.coasterId,
      });
    }
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

    const followingIds: Id<"users">[] = [...new Set([
      userId,
      ...follows.map((f) => f.followingId),
    ])];
    const logsByUser = await Promise.all(
      followingIds.map(async (followingId) =>
        await ctx.db
          .query("rideLogs")
          .withIndex("by_user_and_isFeedEvent", (q) =>
            q.eq("userId", followingId).eq("isFeedEvent", true),
          )
          .order("desc")
          .take(FEED_LIMIT),
      ),
    );
    const pooledLogs = logsByUser.flat().sort((a, b) => b._creationTime - a._creationTime);
    const candidateLogs = pooledLogs.slice(0, FEED_LIMIT);
    if (candidateLogs.length === 0) return [];

    // Use the existing per-person bounded reads to include friends whose logs
    // fall outside the global 50-log window but belong to a visible park day.
    const coasterMap = new Map<Id<"coasters">, Doc<"coasters"> | null>();
    await Promise.all(
      [...new Set(candidateLogs.map((log) => log.coasterId))].map(async (coasterId) => {
        coasterMap.set(coasterId, await ctx.db.get(coasterId));
      }),
    );
    const seedFeedLogs: FeedLog[] = candidateLogs.map((log) => ({
      ...log,
      coaster: coasterMap.get(log.coasterId) ?? null,
    }));
    const selectedKeys = new Set<string>();
    for (const log of seedFeedLogs) {
      if (selectedKeys.size === FEED_GROUP_LIMIT) break;
      selectedKeys.add(feedGroupKey(log, log.coaster));
    }
    const visibleDates = new Set(
      seedFeedLogs
        .filter((log) => selectedKeys.has(feedGroupKey(log, log.coaster)))
        .map((log) => feedRideDate(log)),
    );
    const sameDayPoolLogs = pooledLogs
      .slice(FEED_LIMIT)
      .filter((log) => visibleDates.has(feedRideDate(log)));
    await Promise.all(
      [...new Set(sameDayPoolLogs.map((log) => log.coasterId))]
        .filter((coasterId) => !coasterMap.has(coasterId))
        .map(async (coasterId) => {
          coasterMap.set(coasterId, await ctx.db.get(coasterId));
        }),
    );
    const feedLogs: FeedLog[] = [
      ...seedFeedLogs,
      ...sameDayPoolLogs.map((log) => ({
        ...log,
        coaster: coasterMap.get(log.coasterId) ?? null,
      })),
    ]
      .filter((log) => selectedKeys.has(feedGroupKey(log, log.coaster)))
      .sort((a, b) => b._creationTime - a._creationTime);

    const uniqueUserIds = [...new Set(feedLogs.map((log) => log.userId))];
    const userMap = new Map(
      await Promise.all(
        uniqueUserIds.map(async (feedUserId) => {
          const [user, profile, rankingStats] = await Promise.all([
            ctx.db.get(feedUserId),
            ctx.db
              .query("userProfiles")
              .withIndex("by_userId", (q) => q.eq("userId", feedUserId))
              .unique(),
            getUserRankingStatsDoc(ctx, feedUserId),
          ]);
          return [feedUserId, {
            name: user?.name ?? "Unknown",
            avatarUrl: profile?.avatarUrl ?? null,
            rankingCount: rankingStats?.rankingCount ?? 0,
          }] as const;
        }),
      ),
    );
    const uniquePairs = new Map<string, { userId: Id<"users">; coasterId: Id<"coasters"> }>();
    for (const log of feedLogs) {
      uniquePairs.set(`${log.userId}:${log.coasterId}`, {
        userId: log.userId,
        coasterId: log.coasterId,
      });
    }
    const rankingMap = new Map(
      await Promise.all(
        [...uniquePairs.entries()].map(async ([key, pair]) => [
          key,
          await ctx.db
            .query("rankings")
            .withIndex("by_user_and_coaster", (q) =>
              q.eq("userId", pair.userId).eq("coasterId", pair.coasterId),
            )
            .unique(),
        ] as const),
      ),
    );

    return groupFeedLogs(feedLogs, userMap, rankingMap);
  },
});
