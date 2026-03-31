import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";

export const logRide = mutation({
  args: {
    coasterId: v.id("coasters"),
    riddenAt: v.number(),
    notes: v.optional(v.string()),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Check if already logged
    const existing = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", args.coasterId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        riddenAt: args.riddenAt,
        notes: args.notes,
        rating: args.rating,
      });
      return existing._id;
    }

    const logId = await ctx.db.insert("rideLogs", {
      userId,
      ...args,
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
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const log = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", args.coasterId)
      )
      .unique();
    if (log) await ctx.db.delete(log._id);

    const ranking = await ctx.db
      .query("rankings")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", args.coasterId)
      )
      .unique();
    if (ranking) {
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
      .withIndex("by_user", (q) => q.eq("userId", userId))
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
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
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

export const getMyLogForCoaster = query({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_coaster", (q) =>
        q.eq("userId", userId).eq("coasterId", args.coasterId)
      )
      .unique();
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
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .order("desc")
        .take(10);
      const user = await ctx.db.get(uid);
      const profile = await ctx.db
        .query("userProfiles")
        .withIndex("by_userId", (q) => q.eq("userId", uid))
        .unique();
      for (const log of logs) {
        const coaster = await ctx.db.get(log.coasterId);
        allLogs.push({ ...log, coaster, user, profile });
      }
    }

    allLogs.sort((a, b) => (b._creationTime as number) - (a._creationTime as number));
    return allLogs.slice(0, 50);
  },
});
