import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  userProfiles: defineTable({
    userId: v.id("users"),
    bio: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
    homepark: v.optional(v.string()),
    coasterCount: v.optional(v.number()),
  }).index("by_userId", ["userId"]),

  follows: defineTable({
    followerId: v.id("users"),
    followingId: v.id("users"),
  })
    .index("by_follower", ["followerId"])
    .index("by_following", ["followingId"])
    .index("by_follower_and_following", ["followerId", "followingId"]),

  coasters: defineTable({
    name: v.string(),
    park: v.string(),
    location: v.string(),
    type: v.string(), // "Steel", "Wood", "Hybrid"
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    lastSyncedAt: v.optional(v.number()),
    manufacturer: v.optional(v.string()),
    heightFt: v.optional(v.number()),
    speedMph: v.optional(v.number()),
    lengthFt: v.optional(v.number()),
    inversions: v.optional(v.number()),
    yearOpened: v.optional(v.number()),
    rcdbId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  })
    .index("by_name", ["name"])
    .index("by_park", ["park"])
    .index("by_source_and_sourceId", ["source", "sourceId"])
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
    rating: v.optional(v.number()), // 1-10
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
    .index("by_user", ["userId"])
    .index("by_user_and_coaster", ["userId", "coasterId"])
    .index("by_user_and_rank", ["userId", "rank"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
