import { query, mutation, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  LIMITS,
  validateDisplayName,
  validateOptionalText,
} from "./validation";
import type { Id } from "./_generated/dataModel";

function toClientMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

async function getPrimaryAuthProvider(ctx: QueryCtx, userId: Id<"users">) {
  const googleAccount = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "google")
    )
    .unique();
  if (googleAccount) {
    return "google" as const;
  }

  const discordAccount = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) =>
      q.eq("userId", userId).eq("provider", "discord")
    )
    .unique();
  if (discordAccount) {
    return "discord" as const;
  }

  return null;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

async function getUserProfile(ctx: QueryCtx, userId: Id<"users">) {
  return await ctx.db
    .query("userProfiles")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

async function getFollowCount(
  ctx: QueryCtx,
  kind: "followers" | "following",
  userId: Id<"users">,
) {
  return (
    await ctx.db
      .query("follows")
      .withIndex(kind === "followers" ? "by_following" : "by_follower", (q) =>
        kind === "followers" ? q.eq("followingId", userId) : q.eq("followerId", userId),
      )
      .collect()
  ).length;
}

async function getViewerShellData(ctx: QueryCtx, userId: Id<"users">) {
  const [user, profile, authProvider] = await Promise.all([
    ctx.db.get(userId),
    getUserProfile(ctx, userId),
    getPrimaryAuthProvider(ctx, userId),
  ]);
  return {
    user,
    profile,
    authProvider,
    isAdmin: user?.role === "admin",
  };
}

async function getViewerRelationship(
  ctx: QueryCtx,
  viewerUserId: Id<"users"> | null,
  targetUserId: Id<"users">,
) {
  if (!viewerUserId || viewerUserId === targetUserId) {
    return false;
  }

  const follow = await ctx.db
    .query("follows")
    .withIndex("by_follower_and_following", (q) =>
      q.eq("followerId", viewerUserId).eq("followingId", targetUserId)
    )
    .unique();

  return !!follow;
}

async function getPublicUserSummary(
  ctx: QueryCtx,
  targetUserId: Id<"users">,
  viewerUserId: Id<"users"> | null,
) {
  const user = await ctx.db.get(targetUserId);
  const profile = await getUserProfile(ctx, targetUserId);

  if (!user) {
    return null;
  }

  const [followerCount, followingCount, logs, topRanking, isFollowing] = await Promise.all([
    getFollowCount(ctx, "followers", targetUserId),
    getFollowCount(ctx, "following", targetUserId),
    ctx.db
      .query("rideLogs")
      .withIndex("by_user_and_riddenAt", (q) => q.eq("userId", targetUserId))
      .order("desc")
      .collect(),
    ctx.db
      .query("rankings")
      .withIndex("by_user_and_rank", (q) => q.eq("userId", targetUserId))
      .take(1),
    getViewerRelationship(ctx, viewerUserId, targetUserId),
  ]);

  const uniqueCoasterCount = new Set(logs.map((log) => String(log.coasterId))).size;
  const topRankingEntry = topRanking[0] ?? null;
  const topCoaster = topRankingEntry ? await ctx.db.get(topRankingEntry.coasterId) : null;

  return {
    user: {
      _id: user._id,
      name: user.name,
      image: user.image,
    },
    profile,
    followerCount,
    followingCount,
    uniqueCoasterCount,
    topCoaster,
    isCurrentUser: viewerUserId === targetUserId,
    isFollowing,
  };
}

export const getViewerShell = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await getViewerShellData(ctx, userId);
  },
});

export const getMyProfile = getViewerShell;

export const getMyProfileDashboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const [viewer, logs, topRanking, followerCount, followingCount] = await Promise.all([
      getViewerShellData(ctx, userId),
      ctx.db
        .query("rideLogs")
        .withIndex("by_user_and_riddenAt", (q) => q.eq("userId", userId))
        .order("desc")
        .collect(),
      ctx.db
        .query("rankings")
        .withIndex("by_user_and_rank", (q) => q.eq("userId", userId))
        .take(1),
      getFollowCount(ctx, "followers", userId),
      getFollowCount(ctx, "following", userId),
    ]);

    const recentLogs = logs.slice(0, 10);
    const uniqueCoasterCount = new Set(logs.map((log) => String(log.coasterId))).size;
    const coasterIds = [...new Set([...recentLogs.map((log) => log.coasterId), ...topRanking.map((r) => r.coasterId)])];
    const coasterEntries = await Promise.all(
      coasterIds.map(async (coasterId) => [String(coasterId), await ctx.db.get(coasterId)] as const),
    );
    const coasterMap = new Map(coasterEntries);

    return {
      ...viewer,
      uniqueCoasterCount,
      followerCount,
      followingCount,
      topCoaster: topRanking[0] ? coasterMap.get(String(topRanking[0].coasterId)) ?? null : null,
      recentRides: recentLogs.map((log) => ({
        ...log,
        coaster: coasterMap.get(String(log.coasterId)) ?? null,
      })),
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

    const coasterEntries = await Promise.all(
      recentLogs.map(async (log) => [String(log.coasterId), await ctx.db.get(log.coasterId)] as const),
    );
    const coasterMap = new Map(coasterEntries);
    const recentRides = recentLogs.map((log) => ({
      ...log,
      coaster: coasterMap.get(String(log.coasterId)) ?? null,
    }));

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
      .take(200);

    const userIds = follows.map((follow) =>
      args.kind === "followers" ? follow.followerId : follow.followingId
    );

    const users = await Promise.all(
      userIds.map(async (userId) => {
        const user = await ctx.db.get(userId);
        const profile = await getUserProfile(ctx, userId);
        if (!user) {
          return null;
        }
        return {
          user: {
            _id: user._id,
            name: user.name,
            image: user.image,
          },
          profile,
        };
      })
    );

    return users
      .filter(isPresent)
      .sort((a, b) => (a.user.name ?? "").localeCompare(b.user.name ?? ""));
  },
});

export const upsertProfile = mutation({
  args: {
    name: v.optional(v.string()),
    bio: v.optional(v.string()),
    homepark: v.optional(v.string()),
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
        displayName: trimmedName,
        bio: validateOptionalText(args.bio, "Bio", LIMITS.bio),
        homepark: validateOptionalText(args.homepark, "Home park", LIMITS.homepark),
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
  handler: async (ctx, args) => await getFollowCount(ctx, "followers", args.userId),
});

export const getFollowing = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => await getFollowCount(ctx, "following", args.userId),
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
    const viewerUserId = await getAuthUserId(ctx);

    const handleQuery = queryText.toLowerCase().replace(/^@/, "");
    if (handleQuery && !handleQuery.includes(" ")) {
      const profiles = await ctx.db
        .query("userProfiles")
        .withIndex("by_usernameLower", (q) => q.eq("usernameLower", handleQuery))
        .collect();
      if (profiles.length > 0) {
        const followState = viewerUserId
          ? await Promise.all(
              profiles.map(async (profile) => [
                String(profile.userId),
                await getViewerRelationship(ctx, viewerUserId, profile.userId),
              ] as const),
            )
          : [];
        const followMap = new Map(followState);
        const users = await Promise.all(
          profiles.map(async (profile) => {
            const user = await ctx.db.get(profile.userId);
            if (!user) {
              return null;
            }
            return {
              _id: user._id,
              name: user.name,
              profile,
              isFollowing: followMap.get(String(user._id)) ?? false,
            };
          })
        );
        return users.filter(Boolean);
      }
    }

    const matches = await ctx.db
      .query("userProfiles")
      .withSearchIndex("search_displayName", (q) => q.search("displayName", queryText))
      .take(10);

    const followState = viewerUserId
      ? await Promise.all(
          matches.map(async (profile) => [
            String(profile.userId),
            await getViewerRelationship(ctx, viewerUserId, profile.userId),
          ] as const),
        )
      : [];
    const followMap = new Map(followState);

    const users = await Promise.all(
      matches.map(async (profile) => {
        const user = await ctx.db.get(profile.userId);
        if (!user) {
          return null;
        }
        return {
          _id: user._id,
          name: user.name,
          profile,
          isFollowing: followMap.get(String(user._id)) ?? false,
        };
      })
    );

    return users.filter(isPresent);
  },
});
