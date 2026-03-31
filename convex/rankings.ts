import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const getMyRankings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("asc")
      .collect();
    const withCoasters = await Promise.all(
      rankings.map(async (r) => {
        const coaster = await ctx.db.get(r.coasterId);
        const log = await ctx.db
          .query("rideLogs")
          .withIndex("by_user_and_coaster", (q) =>
            q.eq("userId", userId).eq("coasterId", r.coasterId)
          )
          .unique();
        return { ...r, coaster, log };
      })
    );
    return withCoasters.sort((a, b) => a.rank - b.rank);
  },
});

export const getUserRankings = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const rankings = await ctx.db
      .query("rankings")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("asc")
      .collect();
    const withCoasters = await Promise.all(
      rankings.map(async (r) => {
        const coaster = await ctx.db.get(r.coasterId);
        const log = await ctx.db
          .query("rideLogs")
          .withIndex("by_user_and_coaster", (q) =>
            q.eq("userId", args.userId).eq("coasterId", r.coasterId)
          )
          .unique();
        return { ...r, coaster, log };
      })
    );
    return withCoasters.sort((a, b) => a.rank - b.rank);
  },
});

export const reorderRankings = mutation({
  args: {
    orderedCoasterIds: v.array(v.id("coasters")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existingRankings = await ctx.db
      .query("rankings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (let i = 0; i < args.orderedCoasterIds.length; i++) {
      const coasterId = args.orderedCoasterIds[i];
      const existing = existingRankings.find((r) => r.coasterId === coasterId);
      if (existing) {
        await ctx.db.patch(existing._id, { rank: i + 1 });
      }
    }
  },
});

export const moveRank = mutation({
  args: {
    coasterId: v.id("coasters"),
    direction: v.union(v.literal("up"), v.literal("down")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

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
