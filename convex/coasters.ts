import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const search = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    if (!args.q.trim()) {
      return await ctx.db.query("coasters").order("asc").take(30);
    }
    return await ctx.db
      .query("coasters")
      .withSearchIndex("search_coasters", (q) => q.search("name", args.q))
      .take(20);
  },
});

export const get = query({
  args: { id: v.id("coasters") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getMany = query({
  args: { ids: v.array(v.id("coasters")) },
  handler: async (ctx, args) => {
    const results = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
    return results.filter(Boolean);
  },
});

export const addCustom = mutation({
  args: {
    name: v.string(),
    park: v.string(),
    location: v.string(),
    type: v.string(),
    manufacturer: v.optional(v.string()),
    heightFt: v.optional(v.number()),
    speedMph: v.optional(v.number()),
    lengthFt: v.optional(v.number()),
    inversions: v.optional(v.number()),
    yearOpened: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("coasters", args);
  },
});

export const getTopCoasters = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("coasters").take(30);
  },
});
