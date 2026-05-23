import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const { users: _users, ...otherAuthTables } = authTables;

const applicationTables = {
  users: defineTable({
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(v.union(v.string(), v.null())),
  })
    .index("email", ["email"])
    .index("phone", ["phone"]),

  userProfiles: defineTable({
    userId: v.id("users"),
    displayName: v.optional(v.string()),
    username: v.optional(v.string()),
    usernameLower: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    homepark: v.optional(v.string()),
  })
    .index("by_userId", ["userId"])
    .index("by_usernameLower", ["usernameLower"])
    .searchIndex("search_displayName", {
      searchField: "displayName",
      filterFields: ["userId"],
    }),

  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_follower_and_following", ["followerId", "followingId"]),

  coasters: defineTable({
    name: v.string(),
    parentName: v.optional(v.string()),
    park: v.string(),
    location: v.string(),
    type: v.string(), // "Steel", "Wood", "Hybrid"
    isMultiTrack: v.optional(v.boolean()),
    multiTrackGroupId: v.optional(v.string()),
    sourcePageId: v.optional(v.string()),
    trackName: v.optional(v.string()),
    trackIndex: v.optional(v.number()),
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    manufacturer: v.optional(v.string()),
    product: v.optional(v.string()),
    propulsion: v.optional(v.string()),
    durationSeconds: v.optional(v.number()),
    status: v.optional(v.string()),
    heightFt: v.optional(v.number()),
    speedMph: v.optional(v.number()),
    lengthFt: v.optional(v.number()),
    inversions: v.optional(v.number()),
    yearOpened: v.optional(v.number()),
    imageUrl: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_park", ["park"])
    .index("by_source_and_sourceId", ["source", "sourceId"])
    .index("by_multiTrackGroupId_and_trackIndex", ["multiTrackGroupId", "trackIndex"])
    .searchIndex("search_coasters", {
      searchField: "name",
      filterFields: ["park", "type"],
    }),

  rideLogs: defineTable({
    userId: v.id("users"),
    coasterId: v.id("coasters"),
    riddenAt: v.number(),
    rideDate: v.optional(v.string()),
    notes: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_coaster", ["userId", "coasterId"])
    .index("by_user_and_riddenAt", ["userId", "riddenAt"])
    .index("by_user_and_coaster_and_rideDate", ["userId", "coasterId", "rideDate"])
    .index("by_coaster", ["coasterId"]),

  rankings: defineTable({
    userId: v.id("users"),
    coasterId: v.id("coasters"),
    rank: v.number(),
  })
    .index("by_coaster", ["coasterId"])
    .index("by_user", ["userId"])
    .index("by_user_and_coaster", ["userId", "coasterId"])
    .index("by_user_and_rank", ["userId", "rank"]),

  userRankingStats: defineTable({
    userId: v.id("users"),
    rankingCount: v.number(),
  }).index("by_user", ["userId"]),

  userCoasterStats: defineTable({
    userId: v.id("users"),
    coasterId: v.id("coasters"),
    rideCount: v.number(),
    latestRiddenAt: v.number(),
    latestRideDate: v.optional(v.string()),
    firstRiddenAt: v.optional(v.number()),
  })
    .index("by_user_and_coaster", ["userId", "coasterId"])
    .index("by_user_and_latestRiddenAt", ["userId", "latestRiddenAt"])
    .index("by_coaster", ["coasterId"]),

  coasterStats: defineTable({
    coasterId: v.id("coasters"),
    totalLogCount: v.number(),
    uniqueRiderCount: v.number(),
  }).index("by_coaster", ["coasterId"]),

  trendingCoasters: defineTable({
    key: v.string(),
    coasterIds: v.array(v.id("coasters")),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
};

export default defineSchema({
  ...otherAuthTables,
  ...applicationTables,
});
