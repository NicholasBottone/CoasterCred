import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { LIMITS, validateOptionalText } from "./validation";

export function computeRankingScore(rank: number, totalCount: number) {
  if (totalCount <= 1) {
    return 10.0;
  }

  const percentile = (totalCount - rank) / (totalCount - 1);
  const score = 1 + percentile * 9;
  return Math.round(score * 10) / 10;
}

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

export const getMyRankings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q) => q.eq("userId", userId))
      .collect();
    const totalCount = rankings.length;
    const withCoasters = await Promise.all(
      rankings.map(async (r) => {
        const coaster = await ctx.db.get(r.coasterId);
        const logs = await ctx.db
          .query("rideLogs")
          .withIndex("by_user_and_coaster", (q) =>
            q.eq("userId", userId).eq("coasterId", r.coasterId)
          )
          .collect();
        const log = logs.sort((a, b) => b.riddenAt - a.riddenAt)[0] ?? null;
        return { ...r, coaster, log, score: computeRankingScore(r.rank, totalCount) };
      })
    );
    return withCoasters.sort((a, b) => a.rank - b.rank);
  },
});

export const getUserRankingsPage = query({
  args: {
    userId: v.id("users"),
    page: v.number(),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q) => q.eq("userId", args.userId))
      .collect();

    const safeLimit = Math.max(1, Math.min(args.limit, 50));
    const safePage = Math.max(0, args.page);
    const totalCount = rankings.length;
    const pageCount = Math.max(1, Math.ceil(totalCount / safeLimit));
    const start = safePage * safeLimit;
    const pageItems = rankings.slice(start, start + safeLimit);

    const items = await Promise.all(
      pageItems.map(async (ranking) => ({
        ...ranking,
        coaster: await ctx.db.get(ranking.coasterId),
        score: computeRankingScore(ranking.rank, totalCount),
      }))
    );

    return {
      items,
      page: safePage,
      limit: safeLimit,
      totalCount,
      pageCount,
    };
  },
});

export const getFriendLeaderboard = query({
  args: {
    window: v.union(v.literal("30d"), v.literal("365d"), v.literal("all")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const now = Date.now();
    const cutoff =
      args.window === "30d"
        ? now - 1000 * 60 * 60 * 24 * 30
        : args.window === "365d"
          ? now - 1000 * 60 * 60 * 24 * 365
          : null;
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", userId))
      .collect();

    const userIds: Id<"users">[] = [userId, ...follows.map((follow) => follow.followingId)];

    const leaderboard = await Promise.all(
      userIds.map(async (currentUserId) => {
        const user = await ctx.db.get(currentUserId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", currentUserId))
          .unique();
        const logs = await ctx.db
          .query("rideLogs")
          .withIndex("by_user", (q) => q.eq("userId", currentUserId))
          .collect();

        const logsInWindow =
          cutoff === null
            ? logs
            : logs.filter((log) => log.riddenAt >= cutoff);
        const rideCount = new Set(logsInWindow.map((log) => log.coasterId)).size;
        const lastRideAt = logs.reduce(
          (latest, log) => Math.max(latest, log.riddenAt),
          0,
        );

        return {
          userId: currentUserId,
          user: user
            ? {
                _id: user._id,
                name: user.name,
              }
            : null,
          profile,
          rideCount,
          totalRideCount: logs.length,
          lastRideAt: lastRideAt || null,
          isCurrentUser: currentUserId === userId,
        };
      }),
    );

    return leaderboard
      .filter((entry) => entry.user !== null)
      .sort((a, b) => {
        if (b.rideCount !== a.rideCount) {
          return b.rideCount - a.rideCount;
        }
        if ((b.lastRideAt ?? 0) !== (a.lastRideAt ?? 0)) {
          return (b.lastRideAt ?? 0) - (a.lastRideAt ?? 0);
        }
        return b.totalRideCount - a.totalRideCount;
      });
  },
});

export const saveRideWithRank = mutation({
  args: {
    coasterId: v.id("coasters"),
    riddenAt: v.number(),
    rideDate: v.string(),
    notes: v.optional(v.string()),
    targetRank: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const allRankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q) => q.eq("userId", userId))
      .collect();

    const existingRanking = allRankings.find((r) => r.coasterId === args.coasterId);
    const rankingsWithoutCurrent = existingRanking
      ? allRankings.filter((r) => r._id !== existingRanking._id)
      : allRankings;

    const existingForDay = await getExistingLogForRideDate(
      ctx,
      userId,
      args.coasterId,
      args.rideDate,
    );
    if (existingForDay) {
      throw new ConvexError("You already logged this coaster for that date");
    }

    let notes: string | undefined;
    try {
      notes = validateOptionalText(args.notes, "Notes", LIMITS.notes);
    } catch (error) {
      if (error instanceof Error) {
        throw new ConvexError(error.message);
      }
      throw new ConvexError("Could not log ride");
    }

    await ctx.db.insert("rideLogs", {
      userId,
      coasterId: args.coasterId,
      riddenAt: args.riddenAt,
      rideDate: args.rideDate,
      notes,
    });

    if (existingRanking && args.targetRank === undefined) {
      return existingRanking._id;
    }

    const maxTargetRank = rankingsWithoutCurrent.length + 1;
    const targetRank = Math.max(
      1,
      Math.min(args.targetRank ?? maxTargetRank, maxTargetRank),
    );

    for (let i = 0; i < rankingsWithoutCurrent.length; i++) {
      const ranking = rankingsWithoutCurrent[i];
      const nextRank = i >= targetRank - 1 ? i + 2 : i + 1;
      if (ranking.rank !== nextRank) {
        await ctx.db.patch(ranking._id, { rank: nextRank });
      }
    }

    if (existingRanking) {
      await ctx.db.patch(existingRanking._id, { rank: targetRank });
      return existingRanking._id;
    }

    return await ctx.db.insert("rankings", {
      userId,
      coasterId: args.coasterId,
      rank: targetRank,
    });
  },
});

export const moveRank = mutation({
  args: {
    coasterId: v.id("coasters"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Not authenticated");

    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    rankings.sort((a, b) => a.rank - b.rank);

    const idx = rankings.findIndex((r) => r.coasterId === args.coasterId);
    if (idx === -1) return;

    const swapIdx = args.direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= rankings.length) return;

    const currentRank = rankings[idx].rank;
    const swapRank = rankings[swapIdx].rank;

    await ctx.db.patch(rankings[idx]._id, { rank: swapRank });
    await ctx.db.patch(rankings[swapIdx]._id, { rank: currentRank });
  },
});
