import { query, mutation } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  LIMITS,
  validateAvatarUrl,
  validateDisplayName,
  validateOptionalText,
} from "./validation";
import { Id } from "./_generated/dataModel";

function toClientMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function getViewerRelationship(ctx: any, viewerUserId: Id<"users"> | null, targetUserId: Id<"users">) {
  if (!viewerUserId || viewerUserId === targetUserId) {
    return false;
  }

  const follow = await ctx.db
    .query("follows")
    .withIndex("by_follower_and_following", (q: any) =>
      q.eq("followerId", viewerUserId).eq("followingId", targetUserId)
    )
    .unique();

  return !!follow;
}

async function getPublicUserSummary(ctx: any, targetUserId: Id<"users">, viewerUserId: Id<"users"> | null) {
  const user = await ctx.db.get(targetUserId);
  const profile = await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q: any) => q.eq("userId", targetUserId))
    .unique();

  if (!user) {
    return null;
  }

  const [followers, following, logs, rankings, isFollowing] = await Promise.all([
    ctx.db
      .query("follows")
      .withIndex("by_following", (q: any) => q.eq("followingId", targetUserId))
      .collect(),
    ctx.db
      .query("follows")
      .withIndex("by_follower", (q: any) => q.eq("followerId", targetUserId))
      .collect(),
    ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_riddenAt", (q: any) => q.eq("userId", targetUserId))
      .order("desc")
      .collect(),
    ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q: any) => q.eq("userId", targetUserId))
      .collect(),
    getViewerRelationship(ctx, viewerUserId, targetUserId),
  ]);

  const uniqueCoasterCount = new Set(logs.map((log: any) => String(log.coasterId))).size;
  const topRanking = rankings[0] ?? null;
  const topCoaster = topRanking ? await ctx.db.get(topRanking.coasterId) : null;

  return {
    user: {
      _id: user._id,
      name: user.name,
    },
    profile,
    followerCount: followers.length,
    followingCount: following.length,
    uniqueCoasterCount,
    topCoaster,
    isCurrentUser: viewerUserId === targetUserId,
    isFollowing,
  };
}

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

export const getPublicProfilePreview = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewerUserId = await getAuthUserId(ctx);
    return await getPublicUserSummary(ctx, args.userId, viewerUserId);
  },
});

export const getPublicProfilePage = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const viewerUserId = await getAuthUserId(ctx);
    const summary = await getPublicUserSummary(ctx, args.userId, viewerUserId);
    if (!summary) {
      return null;
    }

    const recentLogs = await ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_riddenAt", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(3);

    const recentRides = await Promise.all(
      recentLogs.map(async (log) => ({
        ...log,
        coaster: await ctx.db.get(log.coasterId),
      }))
    );

    return {
      ...summary,
      recentRides,
    };
  },
});

export const getUserConnections = query({
  args: {
    userId: v.id("users"),
    kind: v.union(v.literal("followers"), v.literal("following")),
  },
  handler: async (ctx, args) => {
    const follows = await ctx.db
      .query("follows")
      .withIndex(args.kind === "followers" ? "by_following" : "by_follower", (q) =>
        args.kind === "followers"
          ? q.eq("followingId", args.userId)
          : q.eq("followerId", args.userId)
      )
      .collect();

    const userIds = follows.map((follow) =>
      args.kind === "followers" ? follow.followerId : follow.followingId
    );

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", userId))
          .unique();
        if (!user) {
          return null;
        }
        return {
          user: {
            _id: user._id,
            name: user.name,
          },
          profile,
        };
      })
    );

    return users
      .filter(Boolean)
      .sort((a: any, b: any) => (a.user.name ?? "").localeCompare(b.user.name ?? ""));
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
    if (!userId) throw new ConvexError("Not authenticated");

    let trimmedName: string | undefined;
    try {
      trimmedName =
        args.name !== undefined ? validateDisplayName(args.name) : undefined;
    } catch (error) {
      throw new ConvexError(toClientMessage(error, "Could not update profile"));
    }
    if (args.name !== undefined) {
      await ctx.db.patch(userId, { name: trimmedName });
    }

    let profilePatch;
    try {
      profilePatch = {
        bio: validateOptionalText(args.bio, "Bio", LIMITS.bio),
        homepark: validateOptionalText(args.homepark, "Home park", LIMITS.homepark),
        avatarUrl: validateAvatarUrl(args.avatarUrl),
      };
    } catch (error) {
      throw new ConvexError(toClientMessage(error, "Could not update profile"));
    }
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
    if (!userId) throw new ConvexError("Not authenticated");
    if (userId === args.targetUserId) throw new ConvexError("Cannot follow yourself");
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
    if (!userId) throw new ConvexError("Not authenticated");
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
