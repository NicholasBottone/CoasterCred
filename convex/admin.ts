import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import {
  action,
  internalQuery,
  query,
  type ActionCtx,
  type QueryCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  buildApiUrl,
  COASTERPEDIA_SOURCE,
  fetchJson,
  normalizeCoaster,
} from "./coasterpedia";

const STALE_SYNC_WINDOW_DAYS = 30;
const STALE_SYNC_WINDOW_MS = STALE_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;

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

    const staleCoasters = coasters
      .filter(
        (coaster) =>
          coaster.source === COASTERPEDIA_SOURCE &&
          (!coaster.lastSyncedAt || coaster.lastSyncedAt < staleBefore),
      )
      .sort((a, b) => (a.lastSyncedAt ?? 0) - (b.lastSyncedAt ?? 0))
      .map((coaster) => ({
        _id: coaster._id,
        name: coaster.name,
        park: coaster.park,
        location: coaster.location,
        sourceId: coaster.sourceId ?? null,
        sourceUrl: coaster.sourceUrl ?? null,
        lastSyncedAt: coaster.lastSyncedAt ?? null,
        staleForMs: coaster.lastSyncedAt ? now - coaster.lastSyncedAt : null,
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

export const syncCoaster = action({
  args: { coasterId: v.id("coasters") },
  handler: async (ctx, args) => {
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
          pageids: target.sourceId,
          prop: "info|revisions",
          inprop: "url",
          rvprop: "content",
          rvslots: "main",
        }),
      );
    } catch {
      throw new ConvexError("Could not refresh this coaster right now");
    }

    const page = (details as any).query?.pages?.[target.sourceId];
    if (!page) {
      throw new ConvexError("Could not find this coaster on Coasterpedia");
    }

    let coaster;
    try {
      coaster = normalizeCoaster(page);
    } catch {
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
