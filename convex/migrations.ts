import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import { HISTORICAL_RIDE_WINDOW_MS, isHistoricalRideDate } from "./feedEvents";
import schema from "./schema";

const migrations = new Migrations(components.migrations, { schema });

// Only touch rerides from the feed's recent ride window. Older backdated logs
// stay out of the feed, matching the rule applied when a new log is saved.
export const includeRecentReridesInFeed = migrations.define({
  table: "rideLogs",
  batchSize: 100,
  customRange: (query) =>
    query.withIndex("by_isFirstCreditLog_and_isFeedEvent_and_riddenAt", (q) =>
      q
        .eq("isFirstCreditLog", false)
        .eq("isFeedEvent", false)
        .gte("riddenAt", Date.now() - HISTORICAL_RIDE_WINDOW_MS - 24 * 60 * 60 * 1000),
    ),
  migrateOne: (_ctx, log) => {
    if (isHistoricalRideDate(log.rideDate, Date.now())) return;
    return { isFeedEvent: true };
  },
});
