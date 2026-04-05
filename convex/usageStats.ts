import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const TRENDING_KEY = "search-default";
const TRENDING_LIMIT = 30;
const TRENDING_SCAN_LIMIT = 200;

type DbCtx = QueryCtx | MutationCtx;

export async function getUserCoasterStatsDoc(
  ctx: DbCtx,
  userId: Id<"users">,
  coasterId: Id<"coasters">,
) {
  return await ctx.db
    .query("userCoasterStats")
    .withIndex("by_user_and_coaster", (q) =>
      q.eq("userId", userId).eq("coasterId", coasterId),
    )
    .unique();
}

export async function getCoasterStatsDoc(
  ctx: DbCtx,
  coasterId: Id<"coasters">,
) {
  return await ctx.db
    .query("coasterStats")
    .withIndex("by_coaster", (q) => q.eq("coasterId", coasterId))
    .unique();
}

export async function getTrendingCoasterIds(ctx: DbCtx) {
  const doc = await ctx.db
    .query("trendingCoasters")
    .withIndex("by_key", (q) => q.eq("key", TRENDING_KEY))
    .unique();
  return doc?.coasterIds ?? [];
}

export async function getUserRankingStatsDoc(
  ctx: DbCtx,
  userId: Id<"users">,
) {
  return await ctx.db
    .query("userRankingStats")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function computeUserCoasterStatsFromLogs(
  ctx: DbCtx,
  userId: Id<"users">,
  coasterId: Id<"coasters">,
) {
  const logs = await ctx.db
    .query("rideLogs")
    .withIndex("by_user_and_coaster", (q) =>
      q.eq("userId", userId).eq("coasterId", coasterId),
    )
    .collect();

  if (logs.length === 0) {
    return null;
  }

  let latestLog = logs[0];
  let firstRiddenAt = logs[0].riddenAt;
  for (const log of logs) {
    if (log.riddenAt > latestLog.riddenAt) {
      latestLog = log;
    }
    if (log.riddenAt < firstRiddenAt) {
      firstRiddenAt = log.riddenAt;
    }
  }

  return {
    userId,
    coasterId,
    rideCount: logs.length,
    latestRiddenAt: latestLog.riddenAt,
    latestRideDate: latestLog.rideDate,
    firstRiddenAt,
  };
}

async function computeCoasterStatsFromLogs(
  ctx: DbCtx,
  coasterId: Id<"coasters">,
) {
  const logs = await ctx.db
    .query("rideLogs")
    .withIndex("by_coaster", (q) => q.eq("coasterId", coasterId))
    .collect();

  if (logs.length === 0) {
    return null;
  }

  return {
    coasterId,
    totalLogCount: logs.length,
    uniqueRiderCount: new Set(logs.map((log) => String(log.userId))).size,
  };
}

async function upsertUserCoasterStats(
  ctx: MutationCtx,
  userId: Id<"users">,
  coasterId: Id<"coasters">,
) {
  const existing = await getUserCoasterStatsDoc(ctx, userId, coasterId);
  const next = await computeUserCoasterStatsFromLogs(ctx, userId, coasterId);

  if (!next) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return;
  }

  if (existing) {
    await ctx.db.patch(existing._id, next);
    return;
  }

  await ctx.db.insert("userCoasterStats", next);
}

async function upsertCoasterStats(ctx: MutationCtx, coasterId: Id<"coasters">) {
  const existing = await getCoasterStatsDoc(ctx, coasterId);
  const next = await computeCoasterStatsFromLogs(ctx, coasterId);

  if (!next) {
    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return;
  }

  if (existing) {
    await ctx.db.patch(existing._id, next);
    return;
  }

  await ctx.db.insert("coasterStats", next);
}

async function rebuildTrendingCoasters(ctx: MutationCtx) {
  const recentLogs = await ctx.db.query("rideLogs").order("desc").take(TRENDING_SCAN_LIMIT);
  const scores = new Map<string, { coasterId: Id<"coasters">; score: number; latest: number }>();

  recentLogs.forEach((log, index) => {
    const key = String(log.coasterId);
    const weight = TRENDING_SCAN_LIMIT - index;
    const existing = scores.get(key);
    if (existing) {
      existing.score += weight;
      existing.latest = Math.max(existing.latest, log.riddenAt);
      return;
    }
    scores.set(key, {
      coasterId: log.coasterId,
      score: weight,
      latest: log.riddenAt,
    });
  });

  const coasterIds = [...scores.values()]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.latest - a.latest;
    })
    .slice(0, TRENDING_LIMIT)
    .map((entry) => entry.coasterId);

  const existing = await ctx.db
    .query("trendingCoasters")
    .withIndex("by_key", (q) => q.eq("key", TRENDING_KEY))
    .unique();

  const nextDoc = {
    key: TRENDING_KEY,
    coasterIds,
    updatedAt: Date.now(),
  };

  if (existing) {
    await ctx.db.patch(existing._id, nextDoc);
    return;
  }

  await ctx.db.insert("trendingCoasters", nextDoc);
}

export async function upsertUserRankingStats(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const existing = await getUserRankingStatsDoc(ctx, userId);
  const rankings = await ctx.db
    .query("rankings")
    .withIndex("by_user_and_rank", (q) => q.eq("userId", userId))
    .collect();

  const next = {
    userId,
    rankingCount: rankings.length,
  };

  if (existing) {
    await ctx.db.patch(existing._id, next);
    return;
  }

  await ctx.db.insert("userRankingStats", next);
}

export const refreshDerivedStatsForRide = internalMutation({
  args: {
    userId: v.id("users"),
    coasterId: v.id("coasters"),
  },
  handler: async (ctx, args) => {
    await upsertUserCoasterStats(ctx, args.userId, args.coasterId);
    await upsertCoasterStats(ctx, args.coasterId);
    await rebuildTrendingCoasters(ctx);
  },
});
