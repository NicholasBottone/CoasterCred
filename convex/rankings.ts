import { query, mutation, internalMutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { LIMITS, validateOptionalText } from "./validation";
import { internal } from "./_generated/api";
import { getUserRankingStatsDoc, upsertUserRankingStats } from "./usageStats";
import { FeedHighlight, formatOrdinal, isHistoricalRideDate } from "./feedEvents";

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
    const [rankings, stats, rankingStats] = await Promise.all([
      ctx.db
        .query("rankings")
        .withIndex("by_user_and_rank", (q) => q.eq("userId", userId))
        .collect(),
      ctx.db
        .query("userCoasterStats")
        .withIndex("by_user_and_latestRiddenAt", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      getUserRankingStatsDoc(ctx, userId),
    ]);
    const totalCount = rankingStats?.rankingCount ?? rankings.length;
    const coasterIds = [...new Set(rankings.map((ranking) => String(ranking.coasterId)))];
    const coasterEntries = await Promise.all(
      coasterIds.map(async (coasterId) => [coasterId, await ctx.db.get(coasterId as Id<"coasters">)] as const),
    );
    const coasterMap = new Map(coasterEntries);
    const statByCoasterId = new Map<string, (typeof stats)[number]>();
    for (const stat of stats) {
      statByCoasterId.set(String(stat.coasterId), stat);
    }
    const withCoasters = rankings.map((ranking) => {
      const coasterId = String(ranking.coasterId);
      const stat = statByCoasterId.get(coasterId);
      return {
        ...ranking,
        coaster: coasterMap.get(coasterId) ?? null,
        log: stat
          ? {
              riddenAt: stat.latestRiddenAt,
              rideDate: stat.latestRideDate ?? null,
            }
          : null,
        rideCount: stat?.rideCount ?? 0,
        score: computeRankingScore(ranking.rank, totalCount),
      };
    });
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
    const [rankings, rankingStats] = await Promise.all([
      ctx.db
        .query("rankings")
        .withIndex("by_user_and_rank", (q) => q.eq("userId", args.userId))
        .collect(),
      getUserRankingStatsDoc(ctx, args.userId),
    ]);

    const safeLimit = Math.max(1, Math.min(args.limit, 50));
    const safePage = Math.max(0, args.page);
    const totalCount = rankingStats?.rankingCount ?? rankings.length;
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
        const [user, profile, stats] = await Promise.all([
          ctx.db.get(currentUserId),
          ctx.db
            .query("userProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", currentUserId))
            .unique(),
          ctx.db
            .query("userCoasterStats")
            .withIndex("by_user_and_latestRiddenAt", (q) => q.eq("userId", currentUserId))
            .order("desc")
            .collect(),
        ]);

        const statsInWindow =
          cutoff === null
            ? stats
            : stats.filter((stat) => stat.latestRiddenAt >= cutoff);
        const rideCount = statsInWindow.length;
        const totalRideCount = stats.reduce((sum, stat) => sum + stat.rideCount, 0);
        const lastRideAt = stats[0]?.latestRiddenAt ?? 0;

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
          totalRideCount,
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
    const coaster = await ctx.db.get(args.coasterId);
    if (!coaster) {
      throw new ConvexError("Coaster not found");
    }

    const existingRanking = allRankings.find((r) => r.coasterId === args.coasterId);
    const rankingsWithoutCurrent = existingRanking
      ? allRankings.filter((r) => r._id !== existingRanking._id)
      : allRankings;
    const isFirstCreditLog = !existingRanking;
    const isHistoricalRide = isHistoricalRideDate(args.rideDate, Date.now());

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

    const feedHighlights: FeedHighlight[] = [];
    if (isFirstCreditLog && !isHistoricalRide) {
      const nextCreditCount = rankingsWithoutCurrent.length + 1;
      if (nextCreditCount % 25 === 0) {
        feedHighlights.push({
          kind: "countMilestone",
          label: `${formatOrdinal(nextCreditCount)} coaster`,
          value: nextCreditCount,
        });
      }

      const country = coaster.country?.trim();
      if (country) {
        const rankedCoasterDocs = await Promise.all(
          rankingsWithoutCurrent.map(async (ranking) => await ctx.db.get(ranking.coasterId)),
        );
        const hasCountryCredit = rankedCoasterDocs.some(
          (rankedCoaster) =>
            typeof rankedCoaster?.country === "string" &&
            rankedCoaster.country.trim().toLowerCase() === country.toLowerCase(),
        );
        if (!hasCountryCredit) {
          feedHighlights.push({
            kind: "countryFirst",
            label: `First coaster in ${country}`,
            country,
          });
        }
      }
    }

    await ctx.db.insert("rideLogs", {
      userId,
      coasterId: args.coasterId,
      riddenAt: args.riddenAt,
      rideDate: args.rideDate,
      notes,
      isFirstCreditLog,
      isFeedEvent: isFirstCreditLog && !isHistoricalRide,
      feedHighlights,
    });
    await ctx.runMutation(internal.usageStats.refreshDerivedStatsForRide, {
      userId,
      coasterId: args.coasterId,
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

    const rankingId = await ctx.db.insert("rankings", {
      userId,
      coasterId: args.coasterId,
      rank: targetRank,
    });
    await upsertUserRankingStats(ctx, userId);
    return rankingId;
  },
});

export const getMyRankingComparisonList = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q) => q.eq("userId", userId))
      .collect();

    const coasterIds = [...new Set(rankings.map((ranking) => String(ranking.coasterId)))];
    const coasterEntries = await Promise.all(
      coasterIds.map(async (coasterId) => [
        coasterId,
        await ctx.db.get(coasterId as Id<"coasters">),
      ] as const),
    );
    const coasterMap = new Map(coasterEntries);

    return rankings.map((ranking) => ({
      ...ranking,
      coaster: coasterMap.get(String(ranking.coasterId)) ?? null,
    }));
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

export const reindexUserRankings = internalMutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q) => q.eq("userId", args.userId))
      .collect();

    rankings.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a._creationTime - b._creationTime;
    });

    for (let index = 0; index < rankings.length; index += 1) {
      const nextRank = index + 1;
      if (rankings[index].rank !== nextRank) {
        await ctx.db.patch(rankings[index]._id, { rank: nextRank });
      }
    }

    await upsertUserRankingStats(ctx, args.userId);
  },
});
