import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { computeRankingScore } from "./rankings";

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

    const allLogs: Array<Record<string, unknown>> = [];

    for (const uid of followingIds) {
      const logs = await ctx.db
        .query("rideLogs")
        .withIndex("by_user_and_riddenAt", (q) => q.eq("userId", uid))
        .order("desc")
        .take(10);
      const user = await ctx.db.get(uid);
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", uid))
        .unique();
      for (const log of logs) {
        const coaster = await ctx.db.get(log.coasterId);
        const coasterLogs = await ctx.db
          .query("rideLogs")
          .withIndex("by_user_and_coaster", (q) =>
            q.eq("userId", uid).eq("coasterId", log.coasterId)
          )
          .collect();
        const rideOrdinal = coasterLogs.filter(
          (coasterLog) => coasterLog.riddenAt <= log.riddenAt
        ).length;
        const rankings = await ctx.db
          .query("rankings")
          .withIndex("by_user_and_rank", (q) => q.eq("userId", uid))
          .collect();
        const currentRanking = rankings.find((ranking) => ranking.coasterId === log.coasterId);
        allLogs.push({
          ...log,
          coaster,
          user: user
            ? {
                _id: user._id,
                name: user.name,
              }
            : null,
          profile,
          rideOrdinal,
          isFirstRide: rideOrdinal === 1,
          score: currentRanking ? computeRankingScore(currentRanking.rank, rankings.length) : null,
        });
      }
    }

    allLogs.sort((a, b) => (b._creationTime as number) - (a._creationTime as number));
    return allLogs.slice(0, 50);
  },
});
