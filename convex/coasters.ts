import { action, internalMutation, query, type ActionCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import { Id } from "./_generated/dataModel";
import { computeRankingScore } from "./rankings";
import {
  buildCoasterGroupId,
  canonicalizeForImportMatch,
  coasterNameMatchesImport,
  COASTERPEDIA_SOURCE,
  fetchCoasterpediaPageById,
  fetchCoasterpediaPages,
  formatCoasterName,
  getCoasterSourcePageId,
  normalizeCoaster,
  normalizeCoasterEntries,
  normalizeImportCoasterName,
  parkMatchesImport,
  searchCoasterpediaTitles,
  type ImportedCoaster,
} from "./coasterpedia";
import {
  getCoasterStatsDoc,
  getUserRankingStatsDoc,
  getUserCoasterStatsDoc,
  getTrendingCoasterIds,
} from "./usageStats";

type ImportedCoasterMatchCandidate = ImportedCoaster & {
  _id?: string;
  nameMatches: boolean;
  parkMatches: boolean;
  parentNameMatches: boolean;
};

type TrackLike = {
  _id?: string;
  source?: string;
  sourceId?: string;
  sourcePageId?: string;
  sourceUrl?: string;
  name: string;
  parentName?: string;
  park: string;
  location: string;
  type: string;
  isMultiTrack?: boolean;
  multiTrackGroupId?: string;
  trackName?: string;
  trackIndex?: number;
};

function sortTrackEntries<T extends { trackIndex?: number; name: string }>(entries: T[]) {
  return entries
    .slice()
    .sort((a, b) => {
      const aIndex = a.trackIndex ?? 0;
      const bIndex = b.trackIndex ?? 0;
      if (aIndex !== bIndex) return aIndex - bIndex;
      return a.name.localeCompare(b.name);
    });
}

function buildGroupSummaryFromTracks<T extends TrackLike>(tracks: T[]) {
  const sortedTracks = sortTrackEntries(tracks);
  const firstTrack = sortedTracks[0];
  const sourcePageId = firstTrack.sourcePageId ?? getCoasterSourcePageId(firstTrack.sourceId ?? "");

  return {
    kind: "multiTrackGroup" as const,
    name: firstTrack.parentName ?? firstTrack.name,
    parentName: firstTrack.parentName ?? firstTrack.name,
    park: firstTrack.park,
    location: firstTrack.location,
    type: firstTrack.type,
    source: firstTrack.source,
    sourcePageId,
    sourceUrl: firstTrack.sourceUrl,
    isMultiTrack: true,
    multiTrackGroupId: firstTrack.multiTrackGroupId ?? buildCoasterGroupId(sourcePageId),
    tracks: sortedTracks,
  };
}

function buildGroupedSearchResults<T extends ImportedCoaster>(coasters: T[]) {
  const grouped = new Map<string, T[]>();

  for (const coaster of coasters) {
    if (coaster.isMultiTrack && coaster.multiTrackGroupId) {
      const existing = grouped.get(coaster.multiTrackGroupId) ?? [];
      existing.push(coaster);
      grouped.set(coaster.multiTrackGroupId, existing);
      continue;
    }
  }

  const results: Array<T | ReturnType<typeof buildGroupSummaryFromTracks<T>>> = [];
  const emittedGroups = new Set<string>();

  for (const coaster of coasters) {
    if (coaster.isMultiTrack && coaster.multiTrackGroupId) {
      if (emittedGroups.has(coaster.multiTrackGroupId)) {
        continue;
      }
      emittedGroups.add(coaster.multiTrackGroupId);
      results.push(buildGroupSummaryFromTracks(grouped.get(coaster.multiTrackGroupId) ?? [coaster]));
      continue;
    }

    results.push(coaster);
  }

  return results;
}

function matchesImportedParentName(coaster: ImportedCoaster, importedName: string) {
  if (!coaster.parentName || !coaster.isMultiTrack) return false;
  return canonicalizeForImportMatch(coaster.parentName) === canonicalizeForImportMatch(importedName);
}

async function attachLocalIds(
  ctx: ActionCtx,
  coasters: ImportedCoaster[],
): Promise<ImportedCoaster[]> {
  const existingEntries = await Promise.all(
    coasters.map(async (coaster) => {
      const existing = await ctx.runQuery(api.coasters.findBySourceId, {
        source: coaster.source,
        sourceId: coaster.sourceId,
      });
      return [coaster.sourceId, existing?._id ?? undefined] as const;
    }),
  );

  const localIdBySourceId = new Map(existingEntries);
  return coasters.map((coaster) => ({
    ...coaster,
    _id: localIdBySourceId.get(coaster.sourceId),
  }));
}

function scoreImportCandidate(candidate: ImportedCoasterMatchCandidate) {
  if (candidate.nameMatches && candidate.parkMatches) return 4;
  if (candidate.nameMatches) return 3;
  if (candidate.parkMatches) return 2;
  return 1;
}

async function loadSearchTitlesForImport(name: string, park: string) {
  const parentheticalBaseName = name.replace(/\s*\([^()]+\)\s*$/, "").trim();
  const queryTexts = Array.from(
    new Set(
      [
        `${name} ${park}`.trim(),
        name,
        `${name.split("(")[0]?.trim() ?? ""} ${park}`.trim(),
        parentheticalBaseName,
        `${parentheticalBaseName} ${park}`.trim(),
      ].filter(Boolean),
    ),
  );

  const titles = new Set<string>();
  for (const queryText of queryTexts) {
    const nextTitles = await searchCoasterpediaTitles(queryText);
    for (const title of nextTitles) {
      titles.add(title);
      if (titles.size >= 12) {
        return Array.from(titles);
      }
    }
  }

  return Array.from(titles);
}

export const searchCoasterpedia = action({
  args: { q: v.string() },
  handler: async (ctx, args) => {
    const queryText = args.q.trim();
    if (!queryText) return [];

    let titles: string[];
    try {
      titles = await searchCoasterpediaTitles(queryText);
    } catch {
      throw new ConvexError("Could not search coasters right now");
    }

    if (titles.length === 0) return [];

    let pages: any[];
    try {
      pages = await fetchCoasterpediaPages({ titles: titles.join("|") });
    } catch {
      throw new ConvexError("Could not load coaster details right now");
    }

    const normalized: ImportedCoaster[] = [];
    for (const page of pages) {
      try {
        normalized.push(...normalizeCoasterEntries(page));
      } catch {
        continue;
      }
    }

    const withLocalIds = await attachLocalIds(ctx, normalized);
    return buildGroupedSearchResults(withLocalIds);
  },
});

export const validateRankingImportRow = action({
  args: {
    name: v.string(),
    park: v.string(),
  },
  handler: async (ctx, args) => {
    const importedName = normalizeImportCoasterName(args.name);
    const importedPark = args.park.trim();

    if (!importedName || !importedPark) {
      throw new ConvexError("Coaster name and park are required");
    }

    let titles: string[];
    try {
      titles = await loadSearchTitlesForImport(importedName, importedPark);
    } catch {
      throw new ConvexError("Could not validate this coaster against Coasterpedia right now");
    }

    if (titles.length === 0) {
      return {
        normalizedName: importedName,
        exactMatch: null,
        candidates: [],
        issue: {
          code: "not_found",
          message: "No Coasterpedia matches were found for this coaster name.",
          fieldNames: ["name"],
        },
      };
    }

    let pages: any[];
    try {
      pages = await fetchCoasterpediaPages({ titles: titles.join("|") });
    } catch {
      throw new ConvexError("Could not load coaster details from Coasterpedia right now");
    }

    const normalized: ImportedCoaster[] = [];
    for (const page of pages) {
      try {
        normalized.push(...normalizeCoasterEntries(page));
      } catch {
        continue;
      }
    }

    const withLocalIds = await attachLocalIds(ctx, normalized);
    const candidates: ImportedCoasterMatchCandidate[] = withLocalIds
      .map((candidate) => ({
        ...candidate,
        nameMatches: coasterNameMatchesImport(candidate.name, candidate.park, importedName),
        parkMatches: parkMatchesImport(candidate.park, importedPark),
        parentNameMatches: matchesImportedParentName(candidate, importedName),
      }))
      .sort((a, b) => {
        const scoreDifference = scoreImportCandidate(b) - scoreImportCandidate(a);
        if (scoreDifference !== 0) return scoreDifference;
        return a.name.localeCompare(b.name);
      });

    const exactMatch =
      candidates.find((candidate) => candidate.nameMatches && candidate.parkMatches) ?? null;

    if (exactMatch) {
      return {
        normalizedName: importedName,
        exactMatch,
        candidates,
        issue: null,
      };
    }

    const matchingTrackChoices = candidates.filter(
      (candidate) => candidate.parentNameMatches && candidate.parkMatches,
    );
    if (matchingTrackChoices.length > 0) {
      return {
        normalizedName: importedName,
        exactMatch: null,
        candidates: sortTrackEntries(matchingTrackChoices),
        issue: {
          code: "track_required",
          message: "This ride has multiple tracks on Coasterpedia. Choose the exact track before importing.",
          fieldNames: ["name"],
        },
      };
    }

    const hasNameMatch = candidates.some((candidate) => candidate.nameMatches);
    const hasParkMatch = candidates.some((candidate) => candidate.parkMatches);
    const issue = hasNameMatch
      ? {
          code: "park_mismatch",
          message: "A coaster with this name was found, but the park does not match Coasterpedia exactly.",
          fieldNames: ["park"],
        }
      : hasParkMatch
        ? {
            code: "name_mismatch",
            message: "Found coasters at this park, but none matched the coaster name exactly.",
            fieldNames: ["name"],
          }
        : {
            code: "no_exact_match",
            message: "Found nearby Coasterpedia results, but none matched both name and park exactly.",
            fieldNames: ["name", "park"],
          };

    return {
      normalizedName: importedName,
      exactMatch: null,
      candidates,
      issue,
    };
  },
});

export const materializeCoasterpediaCoaster = action({
  args: { sourceId: v.string() },
  handler: async (ctx, args): Promise<any> => {
    const existing: any = await ctx.runQuery(api.coasters.findBySourceId, {
      source: COASTERPEDIA_SOURCE,
      sourceId: args.sourceId,
    });
    if (existing) return existing._id;

    let page: any;
    try {
      page = await fetchCoasterpediaPageById(getCoasterSourcePageId(args.sourceId));
    } catch {
      throw new ConvexError("Could not load this coaster right now");
    }

    if (!page) {
      throw new ConvexError("Could not find this coaster");
    }

    let importedCoasters: ImportedCoaster[];
    try {
      importedCoasters = normalizeCoasterEntries(page);
    } catch {
      throw new ConvexError("Could not load this coaster");
    }

    const upsertedIds = new Map<string, Id<"coasters">>();
    for (const coaster of importedCoasters) {
      const coasterId: Id<"coasters"> = await ctx.runMutation(
        internal.coasters.upsertImportedCoaster,
        coaster,
      );
      upsertedIds.set(coaster.sourceId, coasterId);
    }

    const materializedId = upsertedIds.get(args.sourceId);
    if (materializedId) {
      return materializedId;
    }

    if (importedCoasters.length === 1) {
      return upsertedIds.get(importedCoasters[0].sourceId) ?? null;
    }

    throw new ConvexError("Could not find the requested track for this coaster");
  },
});

export const getCoasterProfile = query({
  args: {
    coasterId: v.optional(v.id("coasters")),
    source: v.optional(v.string()),
    sourceId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let localCoaster =
      args.coasterId !== undefined ? await ctx.db.get(args.coasterId) : null;

    if (!localCoaster && args.source && args.sourceId) {
      localCoaster = await ctx.db
        .query("coasters")
        .withIndex("by_source_and_sourceId", (q) =>
          q.eq("source", args.source!).eq("sourceId", args.sourceId!)
        )
        .unique();
    }

    const viewerUserId = await getAuthUserId(ctx);
    if (!viewerUserId) {
      return {
        localCoaster,
        appStats: {
          uniqueRiderCount: 0,
          totalLogCount: 0,
        },
        myStats: {
          hasRidden: false,
          rideCount: 0,
          currentRank: null,
        },
      };
    }

    if (!localCoaster) {
      return {
        localCoaster,
        appStats: {
          uniqueRiderCount: 0,
          totalLogCount: 0,
        },
        myStats: {
          hasRidden: false,
          rideCount: 0,
          currentRank: null,
        },
      };
    }

    const [coasterStats, myStats, myRanking, myRankingStats] = await Promise.all([
      getCoasterStatsDoc(ctx, localCoaster._id),
      getUserCoasterStatsDoc(ctx, viewerUserId, localCoaster._id),
      ctx.db
        .query("rankings")
        .withIndex("by_user_and_coaster", (q) =>
          q.eq("userId", viewerUserId).eq("coasterId", localCoaster._id)
        )
        .unique(),
      getUserRankingStatsDoc(ctx, viewerUserId),
    ]);

    return {
      localCoaster,
      appStats: {
        uniqueRiderCount: coasterStats?.uniqueRiderCount ?? 0,
        totalLogCount: coasterStats?.totalLogCount ?? 0,
      },
      myStats: {
        hasRidden: (myStats?.rideCount ?? 0) > 0,
        rideCount: myStats?.rideCount ?? 0,
        currentRank: myRanking?.rank ?? null,
        currentScore:
          myRanking && typeof myRankingStats?.rankingCount === "number" && myRankingStats.rankingCount > 0
            ? computeRankingScore(myRanking.rank, myRankingStats.rankingCount)
            : null,
      },
    };
  },
});

export const getCoasterFriendSummary = query({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const viewerUserId = await getAuthUserId(ctx);
    if (!viewerUserId) {
      return {
        followedRiderCount: 0,
        averageFollowedScore: null,
        latestFollowedRideAt: null,
        latestFollowedRideDate: null,
      };
    }

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", viewerUserId))
      .collect();
    if (follows.length === 0) {
      return {
        followedRiderCount: 0,
        averageFollowedScore: null,
        latestFollowedRideAt: null,
        latestFollowedRideDate: null,
      };
    }

    const entries = await Promise.all(
      follows.map(async (follow) => {
        const [stat, ranking, rankingStats] = await Promise.all([
          getUserCoasterStatsDoc(ctx, follow.followingId, args.coasterId),
          ctx.db
            .query("rankings")
            .withIndex("by_user_and_coaster", (q) =>
              q.eq("userId", follow.followingId).eq("coasterId", args.coasterId),
            )
            .unique(),
          getUserRankingStatsDoc(ctx, follow.followingId),
        ]);

        if (!stat) return null;

        return {
          latestRideAt: stat.latestRiddenAt,
          latestRideDate: stat.latestRideDate ?? null,
          score:
            ranking && typeof rankingStats?.rankingCount === "number" && rankingStats.rankingCount > 0
              ? computeRankingScore(ranking.rank, rankingStats.rankingCount)
              : null,
        };
      }),
    );

    const followedEntries = entries.filter((entry) => entry !== null);
    const latestEntry = followedEntries.reduce<null | (typeof followedEntries)[number]>(
      (latest, entry) => {
        if (!entry) return latest;
        if (!latest || (entry.latestRideAt ?? 0) > (latest.latestRideAt ?? 0)) {
          return entry;
        }
        return latest;
      },
      null,
    );
    const scoredEntries = followedEntries.filter((entry) => typeof entry?.score === "number");

    return {
      followedRiderCount: followedEntries.length,
      averageFollowedScore:
        scoredEntries.length > 0
          ? Math.round(
              (scoredEntries.reduce((sum, entry) => sum + (entry?.score ?? 0), 0) / scoredEntries.length) *
                10,
            ) / 10
          : null,
      latestFollowedRideAt: latestEntry?.latestRideAt ?? null,
      latestFollowedRideDate: latestEntry?.latestRideDate ?? null,
    };
  },
});

export const getCoasterFollowedRiders = query({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const viewerUserId = await getAuthUserId(ctx);
    if (!viewerUserId) return [];

    const follows = await ctx.db
      .query("follows")
      .withIndex("by_follower", (q) => q.eq("followerId", viewerUserId))
      .collect();
    if (follows.length === 0) return [];

    const entries = await Promise.all(
      follows.map(async (follow) => {
        const [stat, user, profile, ranking, rankingStats] = await Promise.all([
          getUserCoasterStatsDoc(ctx, follow.followingId, args.coasterId),
          ctx.db.get(follow.followingId),
          ctx.db
            .query("userProfiles")
            .withIndex("by_userId", (q) => q.eq("userId", follow.followingId))
            .unique(),
          ctx.db
            .query("rankings")
            .withIndex("by_user_and_coaster", (q) =>
              q.eq("userId", follow.followingId).eq("coasterId", args.coasterId),
            )
            .unique(),
          getUserRankingStatsDoc(ctx, follow.followingId),
        ]);

        if (!stat || !user) return null;

        return {
          user: {
            _id: user._id,
            name: user.name,
          },
          profile,
          rideCount: stat.rideCount,
          lastRideAt: stat.latestRiddenAt,
          lastRideDate: stat.latestRideDate ?? null,
          rank: ranking?.rank ?? null,
          score:
            ranking && typeof rankingStats?.rankingCount === "number" && rankingStats.rankingCount > 0
              ? computeRankingScore(ranking.rank, rankingStats.rankingCount)
              : null,
        };
      }),
    );

    return entries
      .filter((entry) => entry !== null)
      .sort((a, b) => {
        if ((b?.lastRideAt ?? 0) !== (a?.lastRideAt ?? 0)) {
          return (b?.lastRideAt ?? 0) - (a?.lastRideAt ?? 0);
        }
        return (a?.user?.name ?? "").localeCompare(b?.user?.name ?? "");
      });
  },
});

export const getMultiTrackGroupData = query({
  args: { multiTrackGroupId: v.string() },
  handler: async (ctx, args) => {
    const localTracks = sortTrackEntries(
      await ctx.db
        .query("coasters")
        .withIndex("by_multiTrackGroupId_and_trackIndex", (q) =>
          q.eq("multiTrackGroupId", args.multiTrackGroupId),
        )
        .collect(),
    );
    if (localTracks.length === 0) {
      return null;
    }

    const viewerUserId = await getAuthUserId(ctx);
    const trackEntries = await Promise.all(
      localTracks.map(async (track) => {
        const [coasterStats, myStats, myRanking, myRankingStats] = await Promise.all([
          getCoasterStatsDoc(ctx, track._id),
          viewerUserId ? getUserCoasterStatsDoc(ctx, viewerUserId, track._id) : null,
          viewerUserId
            ? ctx.db
                .query("rankings")
                .withIndex("by_user_and_coaster", (q) =>
                  q.eq("userId", viewerUserId).eq("coasterId", track._id),
                )
                .unique()
            : null,
          viewerUserId ? getUserRankingStatsDoc(ctx, viewerUserId) : null,
        ]);

        return {
          coaster: track,
          appStats: {
            uniqueRiderCount: coasterStats?.uniqueRiderCount ?? 0,
            totalLogCount: coasterStats?.totalLogCount ?? 0,
          },
          myStats: {
            hasRidden: (myStats?.rideCount ?? 0) > 0,
            rideCount: myStats?.rideCount ?? 0,
            currentRank: myRanking?.rank ?? null,
            currentScore:
              myRanking && typeof myRankingStats?.rankingCount === "number" && myRankingStats.rankingCount > 0
                ? computeRankingScore(myRanking.rank, myRankingStats.rankingCount)
                : null,
          },
        };
      }),
    );

    const logsByTrack = await Promise.all(
      localTracks.map(async (track) =>
        await ctx.db
          .query("rideLogs")
          .withIndex("by_coaster", (q) => q.eq("coasterId", track._id))
          .collect(),
      ),
    );
    const riderIds = new Set<string>();
    let totalLogCount = 0;
    for (const logs of logsByTrack) {
      totalLogCount += logs.length;
      for (const log of logs) {
        riderIds.add(String(log.userId));
      }
    }

    const firstTrack = localTracks[0];
    const sourcePageId = firstTrack.sourcePageId ?? getCoasterSourcePageId(firstTrack.sourceId ?? "");

    return {
      parent: {
        kind: "multiTrackGroup" as const,
        name: firstTrack.parentName ?? firstTrack.name,
        parentName: firstTrack.parentName ?? firstTrack.name,
        park: firstTrack.park,
        location: firstTrack.location,
        type: firstTrack.type,
        source: firstTrack.source,
        sourcePageId,
        sourceUrl: firstTrack.sourceUrl,
        isMultiTrack: true,
        multiTrackGroupId: firstTrack.multiTrackGroupId ?? buildCoasterGroupId(sourcePageId),
      },
      aggregateStats: {
        uniqueRiderCount: riderIds.size,
        totalLogCount,
        totalRideCount: trackEntries.reduce((sum, entry) => sum + entry.myStats.rideCount, 0),
        tracksRiddenCount: trackEntries.filter((entry) => entry.myStats.hasRidden).length,
        tracksRankedCount: trackEntries.filter((entry) => typeof entry.myStats.currentRank === "number").length,
      },
      tracks: trackEntries,
    };
  },
});

export const getTopCoasters = query({
  args: {},
  handler: async (ctx) => {
    const coasterIds = await getTrendingCoasterIds(ctx);
    const rawCoasterDocs = await Promise.all(coasterIds.map(async (coasterId) => await ctx.db.get(coasterId)));
    const coasterDocs = rawCoasterDocs.filter(
      (coaster): coaster is NonNullable<(typeof rawCoasterDocs)[number]> => coaster !== null,
    );

    const multiTrackGroupIds = Array.from(
      new Set(
        coasterDocs
          .map((coaster) => coaster.multiTrackGroupId)
          .filter((groupId): groupId is string => Boolean(groupId)),
      ),
    );
    const groupedTrackEntries = await Promise.all(
      multiTrackGroupIds.map(async (groupId) => [
        groupId,
        sortTrackEntries(
          await ctx.db
            .query("coasters")
            .withIndex("by_multiTrackGroupId_and_trackIndex", (q) =>
              q.eq("multiTrackGroupId", groupId),
            )
            .collect(),
        ),
      ] as const),
    );
    const tracksByGroupId = new Map(groupedTrackEntries);

    const results: any[] = [];
    const seenGroups = new Set<string>();
    for (const coaster of coasterDocs) {
      if (coaster.isMultiTrack && coaster.multiTrackGroupId) {
        if (seenGroups.has(coaster.multiTrackGroupId)) {
          continue;
        }
        seenGroups.add(coaster.multiTrackGroupId);
        const tracks = tracksByGroupId.get(coaster.multiTrackGroupId) ?? [coaster];
        results.push(buildGroupSummaryFromTracks(tracks));
        continue;
      }

      results.push(coaster);
    }

    return results;
  },
});

export const findBySourceId = query({
  args: {
    source: v.string(),
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("coasters")
      .withIndex("by_source_and_sourceId", (q) =>
        q.eq("source", args.source).eq("sourceId", args.sourceId)
      )
      .unique();
  },
});

export const upsertImportedCoaster = internalMutation({
  args: {
    source: v.string(),
    sourceId: v.string(),
    sourcePageId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
    name: v.string(),
    parentName: v.optional(v.string()),
    park: v.string(),
    location: v.string(),
    type: v.string(),
    isMultiTrack: v.optional(v.boolean()),
    multiTrackGroupId: v.optional(v.string()),
    trackName: v.optional(v.string()),
    trackIndex: v.optional(v.number()),
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("coasters")
      .withIndex("by_source_and_sourceId", (q) =>
        q.eq("source", args.source).eq("sourceId", args.sourceId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
      return existing._id;
    }

    return await ctx.db.insert("coasters", args);
  },
});
