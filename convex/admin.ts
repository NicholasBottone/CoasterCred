import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildApiUrl,
  COASTERPEDIA_SOURCE,
  fetchCoasterpediaPageById,
  fetchJson,
  getCoasterSourcePageId,
  logCoasterpediaNormalizationFailure,
  normalizeCoaster,
  normalizeCoasterEntries,
} from "./coasterpedia";

const STALE_SYNC_WINDOW_DAYS = 365;
const STALE_SYNC_WINDOW_MS = STALE_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const COUNTRY_BACKFILL_BATCH_SIZE = 25;

async function getViewerRole(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    return false;
  }

  const user = await ctx.db.get(userId);
  return user?.role === "admin";
}

async function requireAdminQuery(ctx: QueryCtx) {
  if (!(await getViewerRole(ctx))) {
    throw new ConvexError("Admin access required");
  }
}

export const getUserRole = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.role ?? null;
  },
});

export const patchCoasterFromImport = internalMutation({
  args: {
    coasterId: v.id("coasters"),
    source: v.string(),
    sourceId: v.string(),
    sourcePageId: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    lastSyncedAt: v.number(),
    name: v.string(),
    parentName: v.optional(v.string()),
    park: v.string(),
    location: v.string(),
    country: v.optional(v.string()),
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
    const coaster = await ctx.db.get(args.coasterId);
    if (!coaster) {
      throw new ConvexError("Coaster not found");
    }

    const existingLinkedCoaster = await ctx.db
      .query("coasters")
      .withIndex("by_source_and_sourceId", (q) =>
        q.eq("source", args.source).eq("sourceId", args.sourceId),
      )
      .unique();

    if (existingLinkedCoaster && existingLinkedCoaster._id !== args.coasterId) {
      throw new ConvexError("This Coasterpedia entry is already linked to another coaster");
    }

    await ctx.db.patch(args.coasterId, {
      source: args.source,
      sourceId: args.sourceId,
      sourcePageId: args.sourcePageId,
      sourceUrl: args.sourceUrl,
      lastSyncedAt: args.lastSyncedAt,
      name: args.name,
      parentName: args.parentName,
      park: args.park,
      location: args.location,
      country: args.country,
      type: args.type,
      isMultiTrack: args.isMultiTrack,
      multiTrackGroupId: args.multiTrackGroupId,
      trackName: args.trackName,
      trackIndex: args.trackIndex,
      manufacturer: args.manufacturer,
      product: args.product,
      propulsion: args.propulsion,
      durationSeconds: args.durationSeconds,
      status: args.status,
      heightFt: args.heightFt,
      speedMph: args.speedMph,
      lengthFt: args.lengthFt,
      inversions: args.inversions,
      yearOpened: args.yearOpened,
      imageUrl: args.imageUrl,
    });

    return args.coasterId;
  },
});

async function requireAdminAction(ctx: ActionCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Admin access required");
  }

  const role: string | null = await ctx.runQuery(internal.admin.getUserRole, {
    userId,
  });
  if (role !== "admin") {
    throw new ConvexError("Admin access required");
  }
}

function getCountryBackfillTargetsFromCoasters(
  coasters: Doc<"coasters">[],
  limit: number,
) {
  return coasters
    .filter(
      (coaster) =>
        coaster.source === COASTERPEDIA_SOURCE &&
        typeof coaster.sourceId === "string" &&
        !coaster.country,
    )
    .sort((a, b) => {
      if ((a.lastSyncedAt ?? 0) !== (b.lastSyncedAt ?? 0)) {
        return (a.lastSyncedAt ?? 0) - (b.lastSyncedAt ?? 0);
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((coaster) => ({
      coasterId: coaster._id,
      name: coaster.name,
      sourceId: coaster.sourceId as string,
      sourcePageId: coaster.sourcePageId ?? getCoasterSourcePageId(coaster.sourceId as string),
    }));
}

function getSignupDateParts(timestamp: number) {
  const date = new Date(timestamp);
  const isoDate = date.toISOString().slice(0, 10);
  const label = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return { isoDate, label };
}

export const getViewerAccess = query({
  args: {},
  handler: async (ctx) => {
    return {
      isAdmin: await getViewerRole(ctx),
    };
  },
});

export const getCountryBackfillStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);

    const coasters = await ctx.db.query("coasters").collect();
    const sourceBackedCoasters = coasters.filter(
      (coaster) =>
        coaster.source === COASTERPEDIA_SOURCE &&
        typeof coaster.sourceId === "string",
    );
    const sourceBackedMissingCountry = sourceBackedCoasters.filter((coaster) => !coaster.country);
    const manualMissingCountry = coasters.filter(
      (coaster) =>
        !(coaster.source === COASTERPEDIA_SOURCE && typeof coaster.sourceId === "string") &&
        !coaster.country,
    );

    return {
      batchSize: COUNTRY_BACKFILL_BATCH_SIZE,
      totalCoasterCount: coasters.length,
      sourceBackedCoasterCount: sourceBackedCoasters.length,
      sourceBackedMissingCountryCount: sourceBackedMissingCountry.length,
      sourceBackedWithCountryCount: sourceBackedCoasters.length - sourceBackedMissingCountry.length,
      manualMissingCountryCount: manualMissingCountry.length,
      nextTargets: getCountryBackfillTargetsFromCoasters(coasters, 5).map((coaster) => ({
        coasterId: coaster.coasterId,
        name: coaster.name,
        sourceId: coaster.sourceId,
      })),
    };
  },
});

export const getDashboard = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminQuery(ctx);

    const [coasters, users, profiles, rideLogs, rankings, authAccounts] = await Promise.all([
      ctx.db.query("coasters").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("rideLogs").collect(),
      ctx.db.query("rankings").collect(),
      ctx.db.query("authAccounts").collect(),
    ]);

    const now = Date.now();
    const staleBefore = now - STALE_SYNC_WINDOW_MS;
    const profileByUserId = new Map<string, Doc<"userProfiles">>();
    for (const profile of profiles) {
      profileByUserId.set(String(profile.userId), profile);
    }

    const rideCountByUserId = new Map<string, number>();
    for (const log of rideLogs) {
      const key = String(log.userId);
      rideCountByUserId.set(key, (rideCountByUserId.get(key) ?? 0) + 1);
    }

    const rankingCountByUserId = new Map<string, number>();
    for (const ranking of rankings) {
      const key = String(ranking.userId);
      rankingCountByUserId.set(key, (rankingCountByUserId.get(key) ?? 0) + 1);
    }

    const authProviderByUserId = new Map<string, string>();
    for (const account of authAccounts) {
      const key = String(account.userId);
      if (!authProviderByUserId.has(key)) {
        authProviderByUserId.set(key, account.provider);
      }
    }

    const syncableCoasters = coasters
      .filter(
        (coaster) =>
          coaster.source === COASTERPEDIA_SOURCE &&
          coaster.sourceId !== undefined &&
          coaster.sourceId !== null,
      )
      .map((coaster) => ({
        _id: coaster._id,
        name: coaster.name,
        park: coaster.park,
        location: coaster.location,
        source: coaster.source ?? null,
        sourceId: coaster.sourceId ?? null,
        sourceUrl: coaster.sourceUrl ?? null,
        lastSyncedAt: coaster.lastSyncedAt ?? null,
      }));

    const staleCoasters = coasters
      .filter(
        (coaster) =>
          (coaster.lastSyncedAt === undefined ||
            coaster.lastSyncedAt === null ||
            coaster.lastSyncedAt < staleBefore),
      )
      .sort((a, b) => (a.lastSyncedAt ?? 0) - (b.lastSyncedAt ?? 0))
      .map((coaster) => ({
        _id: coaster._id,
        name: coaster.name,
        park: coaster.park,
        location: coaster.location,
        source: coaster.source ?? null,
        sourceId: coaster.sourceId ?? null,
        sourceUrl: coaster.sourceUrl ?? null,
        lastSyncedAt: coaster.lastSyncedAt ?? null,
        staleForMs: coaster.lastSyncedAt ? now - coaster.lastSyncedAt : null,
        canSync:
          coaster.source === COASTERPEDIA_SOURCE &&
          coaster.sourceId !== undefined &&
          coaster.sourceId !== null,
      }));

    const usersByNewest = users
      .slice()
      .sort((a, b) => b._creationTime - a._creationTime)
      .map((user) => {
        const profile = profileByUserId.get(String(user._id));
        return {
          _id: user._id,
          name: user.name ?? profile?.displayName ?? "Unknown rider",
          image: user.image ?? profile?.avatarUrl ?? null,
          username: profile?.username ?? null,
          homepark: profile?.homepark ?? null,
          createdAt: user._creationTime,
          rideCount: rideCountByUserId.get(String(user._id)) ?? 0,
          rankingCount: rankingCountByUserId.get(String(user._id)) ?? 0,
          authProvider: authProviderByUserId.get(String(user._id)) ?? "unknown",
        };
      });

    const signupCounts = new Map<string, { date: string; label: string; count: number }>();
    for (const user of usersByNewest) {
      const { isoDate, label } = getSignupDateParts(user.createdAt);
      const existing = signupCounts.get(isoDate);
      signupCounts.set(isoDate, {
        date: isoDate,
        label,
        count: (existing?.count ?? 0) + 1,
      });
    }

    const signupSeries = Array.from(signupCounts.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    );
    const syncedCoasterCount = coasters.filter(
      (coaster) => coaster.source === COASTERPEDIA_SOURCE,
    ).length;

    return {
      staleThresholdDays: STALE_SYNC_WINDOW_DAYS,
      summary: {
        syncedCoasterCount,
        staleCoasterCount: staleCoasters.length,
        userCount: usersByNewest.length,
      },
      syncableCoasters: syncableCoasters.sort((a, b) => a.name.localeCompare(b.name)),
      staleCoasters,
      signupSeries,
      users: usersByNewest,
    };
  },
});

export const getSyncTarget = internalQuery({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
    const coaster = await ctx.db.get(args.coasterId);
    if (!coaster) {
      return null;
    }

    return {
      _id: coaster._id,
      source: coaster.source ?? null,
      sourceId: coaster.sourceId ?? null,
      name: coaster.name,
    };
  },
});

export const getMultiTrackMigrationTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const coasters = await ctx.db.query("coasters").collect();
    return coasters
      .filter(
        (coaster) =>
          coaster.source === COASTERPEDIA_SOURCE &&
          typeof coaster.sourceId === "string" &&
          !coaster.sourceId.includes("::") &&
          !coaster.multiTrackGroupId &&
          !coaster.trackName,
      )
      .map((coaster) => ({
        _id: coaster._id,
        name: coaster.name,
        sourceId: coaster.sourceId as string,
      }));
  },
});

export const getCountryBackfillTargets = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const safeLimit = Math.max(1, Math.min(args.limit, 100));
    const coasters = await ctx.db.query("coasters").collect();
    return getCountryBackfillTargetsFromCoasters(coasters, safeLimit);
  },
});

export const patchCoasterCountry = internalMutation({
  args: {
    coasterId: v.id("coasters"),
    country: v.string(),
  },
  handler: async (ctx, args) => {
    const coaster = await ctx.db.get(args.coasterId);
    if (!coaster) {
      throw new ConvexError("Coaster not found");
    }

    await ctx.db.patch(args.coasterId, { country: args.country });
  },
});

export const migrateLegacyMultiTrackCoasterData = internalMutation({
  args: {
    legacyCoasterId: v.id("coasters"),
    replacementCoasterId: v.id("coasters"),
  },
  handler: async (ctx, args) => {
    const [legacyCoaster, replacementCoaster] = await Promise.all([
      ctx.db.get(args.legacyCoasterId),
      ctx.db.get(args.replacementCoasterId),
    ]);
    if (!legacyCoaster || !replacementCoaster) {
      throw new ConvexError("Could not migrate this multi-track coaster");
    }

    const [logs, rankings] = await Promise.all([
      ctx.db
        .query("rideLogs")
        .withIndex("by_coaster", (q) => q.eq("coasterId", args.legacyCoasterId))
        .collect(),
      ctx.db
        .query("rankings")
        .withIndex("by_coaster", (q) => q.eq("coasterId", args.legacyCoasterId))
        .collect(),
    ]);

    const affectedUserIds = new Set<Id<"users">>();
    let movedLogCount = 0;
    let movedRankingCount = 0;

    for (const log of logs) {
      affectedUserIds.add(log.userId);
      const existingLog =
        log.rideDate
          ? await ctx.db
              .query("rideLogs")
              .withIndex("by_user_and_coaster_and_rideDate", (q) =>
                q.eq("userId", log.userId).eq("coasterId", args.replacementCoasterId).eq("rideDate", log.rideDate!),
              )
              .unique()
          : null;

      if (existingLog) {
        await ctx.db.delete(log._id);
        continue;
      }

      await ctx.db.patch(log._id, { coasterId: args.replacementCoasterId });
      movedLogCount += 1;
    }

    for (const ranking of rankings) {
      affectedUserIds.add(ranking.userId);
      const existingRanking = await ctx.db
        .query("rankings")
        .withIndex("by_user_and_coaster", (q) =>
          q.eq("userId", ranking.userId).eq("coasterId", args.replacementCoasterId),
        )
        .unique();

      if (existingRanking) {
        await ctx.db.delete(ranking._id);
        continue;
      }

      await ctx.db.patch(ranking._id, { coasterId: args.replacementCoasterId });
      movedRankingCount += 1;
    }

    for (const userId of affectedUserIds) {
      await ctx.runMutation(internal.usageStats.refreshDerivedStatsForRide, {
        userId,
        coasterId: args.legacyCoasterId,
      });
      await ctx.runMutation(internal.usageStats.refreshDerivedStatsForRide, {
        userId,
        coasterId: args.replacementCoasterId,
      });
      await ctx.runMutation(internal.rankings.reindexUserRankings, { userId });
    }

    await ctx.db.delete(args.legacyCoasterId);

    return {
      movedLogCount,
      movedRankingCount,
      affectedUserCount: affectedUserIds.size,
      deletedLegacyCoasterId: args.legacyCoasterId,
    };
  },
});

export const syncCoaster = action({
  args: { coasterId: v.id("coasters") },
  handler: async (
    ctx,
    args,
  ): Promise<{ coasterId: Id<"coasters">; name: string; lastSyncedAt: number }> => {
    await requireAdminAction(ctx);

    const target: {
      _id: Id<"coasters">;
      source: string | null;
      sourceId: string | null;
      name: string;
    } | null = await ctx.runQuery(internal.admin.getSyncTarget, {
      coasterId: args.coasterId,
    });

    if (!target) {
      throw new ConvexError("Coaster not found");
    }
    if (target.source !== COASTERPEDIA_SOURCE || !target.sourceId) {
      throw new ConvexError("Only Coasterpedia coasters can be synced");
    }

    let details: unknown;
    try {
      details = await fetchJson(
        buildApiUrl({
          action: "query",
          pageids: getCoasterSourcePageId(target.sourceId),
          prop: "info|revisions",
          inprop: "url",
          rvprop: "content",
          rvslots: "main",
        }),
      );
    } catch {
      throw new ConvexError("Could not refresh this coaster right now");
    }

    const page: any = (details as any).query?.pages?.[getCoasterSourcePageId(target.sourceId)];
    if (!page) {
      throw new ConvexError("Could not find this coaster on Coasterpedia");
    }

    let coaster;
    try {
      coaster =
        normalizeCoasterEntries(page).find((entry) => entry.sourceId === target.sourceId) ??
        normalizeCoaster(page);
    } catch (error) {
      logCoasterpediaNormalizationFailure("admin.syncCoaster", page, error);
      throw new ConvexError("Could not parse this coaster from Coasterpedia");
    }

    const syncedId: Id<"coasters"> = await ctx.runMutation(
      internal.coasters.upsertImportedCoaster,
      coaster,
    );

    return {
      coasterId: syncedId,
      name: coaster.name,
      lastSyncedAt: coaster.lastSyncedAt,
    };
  },
});

export const linkAndSyncCoaster = action({
  args: {
    coasterId: v.id("coasters"),
    sourceId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);

    let details: unknown;
    try {
      details = await fetchJson(
        buildApiUrl({
          action: "query",
          pageids: getCoasterSourcePageId(args.sourceId),
          prop: "info|revisions",
          inprop: "url",
          rvprop: "content",
          rvslots: "main",
        }),
      );
    } catch {
      throw new ConvexError("Could not load this coaster right now");
    }

    const page: any = (details as any).query?.pages?.[getCoasterSourcePageId(args.sourceId)];
    if (!page) {
      throw new ConvexError("Could not find this coaster on Coasterpedia");
    }

    let coaster;
    try {
      coaster =
        normalizeCoasterEntries(page).find((entry) => entry.sourceId === args.sourceId) ??
        normalizeCoaster(page);
    } catch (error) {
      logCoasterpediaNormalizationFailure("admin.linkAndSyncCoaster", page, error);
      throw new ConvexError("Could not parse this coaster from Coasterpedia");
    }

    const coasterId: Id<"coasters"> = await ctx.runMutation(
      internal.admin.patchCoasterFromImport,
      {
        coasterId: args.coasterId,
        ...coaster,
      },
    );

    return {
      coasterId,
      name: coaster.name,
      linkedSourceId: coaster.sourceId,
      lastSyncedAt: coaster.lastSyncedAt,
    };
  },
});

export const backfillCoasterCountries = action({
  args: {
    batchSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminAction(ctx);

    const batchSize = Math.max(1, Math.min(args.batchSize ?? COUNTRY_BACKFILL_BATCH_SIZE, 100));
    const targets: {
      coasterId: Id<"coasters">;
      name: string;
      sourceId: string;
      sourcePageId: string;
    }[] = await ctx.runQuery(internal.admin.getCountryBackfillTargets, {
      limit: batchSize,
    });

    if (targets.length === 0) {
      return {
        scanned: 0,
        updated: 0,
        skippedNoCountryInSource: 0,
        failed: 0,
        done: true,
      };
    }

    const targetsByPageId = new Map<
      string,
      { coasterId: Id<"coasters">; name: string; sourceId: string; sourcePageId: string }[]
    >();
    for (const target of targets) {
      const existing = targetsByPageId.get(target.sourcePageId) ?? [];
      existing.push(target);
      targetsByPageId.set(target.sourcePageId, existing);
    }

    let updated = 0;
    let skippedNoCountryInSource = 0;
    let failed = 0;

    for (const [sourcePageId, pageTargets] of targetsByPageId) {
      let page: any;
      try {
        page = await fetchCoasterpediaPageById(sourcePageId);
      } catch {
        failed += pageTargets.length;
        continue;
      }

      let importedEntries;
      try {
        importedEntries = normalizeCoasterEntries(page);
      } catch (error) {
        logCoasterpediaNormalizationFailure("admin.backfillCoasterCountries", page, error);
        failed += pageTargets.length;
        continue;
      }

      for (const target of pageTargets) {
        const imported = importedEntries.find((entry) => entry.sourceId === target.sourceId);
        const country = imported?.country?.trim();
        if (!country) {
          skippedNoCountryInSource += 1;
          continue;
        }

        await ctx.runMutation(internal.admin.patchCoasterCountry, {
          coasterId: target.coasterId,
          country,
        });
        updated += 1;
      }
    }

    const remainingStatus: {
      batchSize: number;
      totalCoasterCount: number;
      sourceBackedCoasterCount: number;
      sourceBackedMissingCountryCount: number;
      sourceBackedWithCountryCount: number;
      manualMissingCountryCount: number;
      nextTargets: { coasterId: Id<"coasters">; name: string; sourceId: string }[];
    } = await ctx.runQuery(api.admin.getCountryBackfillStatus, {});

    return {
      scanned: targets.length,
      updated,
      skippedNoCountryInSource,
      failed,
      done: remainingStatus.sourceBackedMissingCountryCount === 0,
      remainingSourceBackedMissingCountryCount: remainingStatus.sourceBackedMissingCountryCount,
    };
  },
});

export const migrateMultiTrackCoasters = action({
  args: {},
  handler: async (ctx) => {
    await requireAdminAction(ctx);

    const targets: { _id: Id<"coasters">; name: string; sourceId: string }[] = await ctx.runQuery(
      internal.admin.getMultiTrackMigrationTargets,
      {},
    );

    let migratedCoasterCount = 0;
    let createdTrackCount = 0;
    let movedLogCount = 0;
    let movedRankingCount = 0;

    for (const target of targets) {
      let page: any;
      try {
        page = await fetchCoasterpediaPageById(target.sourceId);
      } catch {
        continue;
      }

      if (!page) {
        continue;
      }

      let importedCoasters;
      try {
        importedCoasters = normalizeCoasterEntries(page);
      } catch (error) {
        logCoasterpediaNormalizationFailure("admin.migrateMultiTrackCoasters", page, error);
        continue;
      }

      if (importedCoasters.length <= 1) {
        continue;
      }

      const upsertedIds = new Map<string, Id<"coasters">>();
      for (const coaster of importedCoasters) {
        const coasterId: Id<"coasters"> = await ctx.runMutation(
          internal.coasters.upsertImportedCoaster,
          coaster,
        );
        upsertedIds.set(coaster.sourceId, coasterId);
      }

      const firstTrack = importedCoasters
        .slice()
        .sort((a, b) => (a.trackIndex ?? 0) - (b.trackIndex ?? 0))[0];
      const replacementCoasterId = upsertedIds.get(firstTrack.sourceId);
      if (!replacementCoasterId) {
        continue;
      }

      const migrationResult: {
        movedLogCount: number;
        movedRankingCount: number;
      } = await ctx.runMutation(internal.admin.migrateLegacyMultiTrackCoasterData, {
        legacyCoasterId: target._id,
        replacementCoasterId,
      });

      migratedCoasterCount += 1;
      createdTrackCount += importedCoasters.length;
      movedLogCount += migrationResult.movedLogCount;
      movedRankingCount += migrationResult.movedRankingCount;
    }

    return {
      migratedCoasterCount,
      createdTrackCount,
      movedLogCount,
      movedRankingCount,
    };
  },
});
