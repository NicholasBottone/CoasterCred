import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  LIMITS,
  validateAvatarUrl,
  validateDisplayName,
  validateOptionalText,
} from "./validation";

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get(userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    return { user, profile };
  },
});

export const getProfile = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const authUserId = await getAuthUserId(ctx);
    const user = await ctx.db.get(args.userId);
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (!user) {
      return { user: null, profile };
    }
    return {
      user:
        authUserId === args.userId
          ? user
          : {
              _id: user._id,
              name: user.name,
            },
      profile,
    };
  },
});

export const upsertProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    homepark: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const trimmedName =
      args.name !== undefined ? validateDisplayName(args.name) : undefined;
    if (args.name !== undefined) {
      await ctx.db.patch(userId, { name: trimmedName });
    }

    const profilePatch = {
      bio: validateOptionalText(args.bio, "Bio", LIMITS.bio),
      homepark: validateOptionalText(args.homepark, "Home park", LIMITS.homepark),
      avatarUrl: validateAvatarUrl(args.avatarUrl),
    };
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, profilePatch);
    } else {
      await ctx.db.insert("userProfiles", { userId, ...profilePatch });
    }
  },
});

export const getFollowers = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_following", (q) => q.eq("followingId", args.userId))
      .collect();
    return follows.length;
  },
});

export const getFollowing = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
    return follows.length;
  },
});

export const isFollowing = query({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    const follow = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", userId).eq("followingId", args.targetUserId)
      )
      .unique();
    return !!follow;
  },
});

export const follow = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    if (userId === args.targetUserId) throw new Error("Cannot follow yourself");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", userId).eq("followingId", args.targetUserId)
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("follows", {
        followerId: userId,
        followingId: args.targetUserId,
      });
    }
  },
});

export const unfollow = mutation({
  args: { targetUserId: v.id("users") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("follows")
      .withIndex("by_follower_and_following", (q) =>
        q.eq("followerId", userId).eq("followingId", args.targetUserId)
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const searchUsers = query({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const queryText = args.q.trim();
    if (!queryText) return [];

    const allUsers = await ctx.db.query("users").collect();
    const lower = queryText.toLowerCase();
    const hasExactEmailMatch = lower.includes("@");
    const matches = allUsers
      .filter(
        (u) =>
          u.name?.toLowerCase().includes(lower) ||
          (hasExactEmailMatch && u.email?.toLowerCase() === lower)
      )
      .slice(0, 10);

    return await Promise.all(
      matches.map(async (user) => {
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", user._id))
          .unique();
        return {
          _id: user._id,
          name: user.name,
          profile,
        };
      })
    );
  },
});

export const getFollowingList = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", args.userId))
      .collect();
    const users = await Promise.all(
      follows.map(async (f) => {
        const user = await ctx.db.get(f.followingId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", f.followingId))
          .unique();
        return {
          user: user
            ? {
                _id: user._id,
                name: user.name,
              }
            : null,
          profile,
        };
      })
    );
    return users.filter((u) => u.user !== null);
  },
});
