import { query, mutation, type QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  LIMITS,
  validateDisplayName,
  validateOptionalText,
} from "./validation";
import type { Doc, Id } from "./_generated/dataModel";

const WRAPPED_METRIC_DEFS = [
  { key: "heightFt", field: "heightFt" },
  { key: "speedMph", field: "speedMph" },
  { key: "lengthFt", field: "lengthFt" },
  { key: "durationSeconds", field: "durationSeconds" },
  { key: "inversions", field: "inversions" },
] as const;

type WrappedMetricKey = (typeof WRAPPED_METRIC_DEFS)[number]["key"] | "ageYears";
type WrappedMetric = {
  key: WrappedMetricKey;
  coaster: Doc<"coasters"> | null;
  value: number | null;
  total: number | null;
  average: number | null;
  count: number;
};
type WrappedPeriodStats = {
  key: string;
  label: string;
  year: number | null;
  uniqueCoasterCount: number;
  parkCount: number;
  countryCount: number;
  topManufacturer: {
    name: string;
    count: number;
  } | null;
  metrics: Record<WrappedMetricKey, WrappedMetric>;
};

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

function getRideLogYear(log: Doc<"rideLogs">) {
  const rideDateYear = log.rideDate?.match(/^(\d{4})/)?.[1];
  if (rideDateYear) {
    const year = Number(rideDateYear);
    return Number.isFinite(year) ? year : null;
  }

  const riddenAtYear = new Date(log.riddenAt).getUTCFullYear();
  return Number.isFinite(riddenAtYear) ? riddenAtYear : null;
}

function normalizeStatKey(value: string) {
  return value.trim().toLowerCase();
}

function createEmptyWrappedMetric(key: WrappedMetricKey): WrappedMetric {
  return {
    key,
    coaster: null,
    value: null,
    total: null,
    average: null,
    count: 0,
  };
}

function getMetricValue(
  coaster: Doc<"coasters">,
  key: WrappedMetricKey,
  currentYear: number,
) {
  if (key === "ageYears") {
    if (typeof coaster.yearOpened !== "number") {
      return null;
    }
    const ageYears = currentYear - coaster.yearOpened;
    return Number.isFinite(ageYears) && ageYears >= 0 ? ageYears : null;
  }

  const value = coaster[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildWrappedPeriodStats(
  key: string,
  label: string,
  year: number | null,
  coasters: Doc<"coasters">[],
  currentYear: number,
): WrappedPeriodStats {
  const parkKeys = new Set<string>();
  const countryKeys = new Set<string>();
  const manufacturerCounts = new Map<string, { name: string; count: number }>();
  const metrics: Record<WrappedMetricKey, WrappedMetric> = {
    heightFt: createEmptyWrappedMetric("heightFt"),
    speedMph: createEmptyWrappedMetric("speedMph"),
    lengthFt: createEmptyWrappedMetric("lengthFt"),
    durationSeconds: createEmptyWrappedMetric("durationSeconds"),
    inversions: createEmptyWrappedMetric("inversions"),
    ageYears: createEmptyWrappedMetric("ageYears"),
  };

  for (const coaster of coasters) {
    const park = coaster.park.trim();
    if (park) {
      parkKeys.add(normalizeStatKey(park));
    }

    const country = coaster.country?.trim();
    if (country) {
      countryKeys.add(normalizeStatKey(country));
    }

    const manufacturer = coaster.manufacturer?.trim();
    if (manufacturer) {
      const manufacturerKey = normalizeStatKey(manufacturer);
      const current = manufacturerCounts.get(manufacturerKey);
      manufacturerCounts.set(manufacturerKey, {
        name: current?.name ?? manufacturer,
        count: (current?.count ?? 0) + 1,
      });
    }

    for (const metricKey of Object.keys(metrics) as WrappedMetricKey[]) {
      const value = getMetricValue(coaster, metricKey, currentYear);
      if (value === null) {
        continue;
      }

      const metric = metrics[metricKey];
      metric.count += 1;
      metric.total = (metric.total ?? 0) + value;
      metric.average = metric.total / metric.count;
      if (metric.value === null || value > metric.value) {
        metric.value = value;
        metric.coaster = coaster;
      }
    }
  }

  const topManufacturer =
    [...manufacturerCounts.values()].sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.name.localeCompare(b.name);
    })[0] ?? null;

  return {
    key,
    label,
    year,
    uniqueCoasterCount: coasters.length,
    parkCount: parkKeys.size,
    countryCount: countryKeys.size,
    topManufacturer,
    metrics,
  };
}

async function buildWrappedStats(ctx: QueryCtx, logs: Doc<"rideLogs">[]) {
  const uniqueCoasterIds = [...new Set(logs.map((log) => String(log.coasterId)))];
  const coasterEntries = await Promise.all(
    uniqueCoasterIds.map(async (coasterId) => [
      coasterId,
      await ctx.db.get(coasterId as Id<"coasters">),
    ] as const),
  );
  const coasterMap = new Map(
    coasterEntries.filter(
      (entry): entry is readonly [string, Doc<"coasters">] => entry[1] !== null,
    ),
  );
  const currentYear = new Date().getUTCFullYear();
  const allTimeCoasters = [...coasterMap.values()];
  const coastersByYear = new Map<number, Map<string, Doc<"coasters">>>();

  for (const log of logs) {
    const year = getRideLogYear(log);
    const coaster = coasterMap.get(String(log.coasterId));
    if (year === null || !coaster) {
      continue;
    }

    const yearCoasters = coastersByYear.get(year) ?? new Map<string, Doc<"coasters">>();
    yearCoasters.set(String(coaster._id), coaster);
    coastersByYear.set(year, yearCoasters);
  }

  return {
    allTime: buildWrappedPeriodStats("all", "All time", null, allTimeCoasters, currentYear),
    yearly: [...coastersByYear.entries()]
      .sort(([a], [b]) => b - a)
      .map(([year, yearCoasters]) =>
        buildWrappedPeriodStats(String(year), String(year), year, [...yearCoasters.values()], currentYear),
      ),
  };
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
  const [topCoaster, wrappedStats] = await Promise.all([
    topRankingEntry ? ctx.db.get(topRankingEntry.coasterId) : null,
    buildWrappedStats(ctx, logs),
  ]);

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
    wrappedStats,
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
    const wrappedStats = await buildWrappedStats(ctx, logs);

    return {
      ...viewer,
      uniqueCoasterCount,
      followerCount,
      followingCount,
      topCoaster: topRanking[0] ? coasterMap.get(String(topRanking[0].coasterId)) ?? null : null,
      wrappedStats,
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
