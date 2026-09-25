import type { Doc, Id } from "./_generated/dataModel";
import { computeRankingScore } from "./rankingScore";
import { normalizeCoasterLocation } from "./coasterLocation";

export type FeedLog = Doc<"rideLogs"> & { coaster: Doc<"coasters"> | null };

export type FeedUser = {
  name: string;
  avatarUrl: string | null;
  rankingCount: number;
};

export function feedRideDate(log: Doc<"rideLogs">) {
  if (log.rideDate) return log.rideDate;
  const timestamp = Number.isFinite(log.riddenAt) ? log.riddenAt : log._creationTime;
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function feedGroupKey(log: Doc<"rideLogs">, coaster: Doc<"coasters"> | null) {
  return JSON.stringify([
    feedRideDate(log),
    coaster?.park.trim().toLowerCase() ?? String(log.coasterId),
    coaster ? normalizeCoasterLocation(coaster.location, coaster.country).toLowerCase() : "",
  ]);
}

function feedCoasterSummary(coaster: Doc<"coasters">) {
  return {
    _id: coaster._id,
    name: coaster.name,
    parentName: coaster.parentName,
    park: coaster.park,
    location: normalizeCoasterLocation(coaster.location, coaster.country),
    country: coaster.country,
    type: coaster.type,
    source: coaster.source,
    sourceId: coaster.sourceId,
    sourcePageId: coaster.sourcePageId,
    sourceUrl: coaster.sourceUrl,
    isMultiTrack: coaster.isMultiTrack,
    multiTrackGroupId: coaster.multiTrackGroupId,
    trackName: coaster.trackName,
    trackIndex: coaster.trackIndex,
  };
}

type FeedPerson = { _id: Id<"users">; name: string; avatarUrl: string | null };
type FeedRider = FeedPerson & {
  logId: Id<"rideLogs">;
  isFirstCreditLog: boolean;
  score: number | null;
  rank: number | null;
  notes: string | null;
  feedHighlights: NonNullable<Doc<"rideLogs">["feedHighlights"]>;
};
type FeedCoaster = {
  coaster: ReturnType<typeof feedCoasterSummary> | null;
  lastActivityAt: number;
  riders: FeedRider[];
};
type FeedGroup = {
  key: string;
  park: string;
  location: string;
  rideDate: string;
  lastActivityAt: number;
  firstCreditCount: number;
  rerideCount: number;
  people: FeedPerson[];
  coasters: FeedCoaster[];
};

export function groupFeedLogs(
  feedLogs: FeedLog[],
  userMap: Map<Id<"users">, FeedUser>,
  rankingMap: Map<string, Doc<"rankings"> | null>,
): FeedGroup[] {
  const groups = new Map<string, FeedGroup>();
  const coasterGroups = new Map<string, Map<Id<"coasters">, FeedCoaster>>();
  for (const log of [...feedLogs].sort((a, b) => b._creationTime - a._creationTime)) {
    const key = feedGroupKey(log, log.coaster);
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        park: log.coaster?.park ?? "Unknown park",
        location: log.coaster
          ? normalizeCoasterLocation(log.coaster.location, log.coaster.country)
          : "",
        rideDate: feedRideDate(log),
        lastActivityAt: log._creationTime,
        firstCreditCount: 0,
        rerideCount: 0,
        people: [],
        coasters: [],
      };
      groups.set(key, group);
      coasterGroups.set(key, new Map());
    }
    group.lastActivityAt = Math.max(group.lastActivityAt, log._creationTime);
    if (log.isFirstCreditLog) group.firstCreditCount += 1;
    else group.rerideCount += 1;

    const user = userMap.get(log.userId);
    const person = {
      _id: log.userId,
      name: user?.name ?? "Unknown",
      avatarUrl: user?.avatarUrl ?? null,
    };
    if (!group.people.some((existing) => existing._id === log.userId)) {
      group.people.push(person);
    }
    const ranking = rankingMap.get(`${log.userId}:${log.coasterId}`);
    const coasterMapForGroup = coasterGroups.get(key)!;
    let coasterGroup = coasterMapForGroup.get(log.coasterId);
    if (!coasterGroup) {
      coasterGroup = {
        coaster: log.coaster ? feedCoasterSummary(log.coaster) : null,
        lastActivityAt: log._creationTime,
        riders: [],
      };
      coasterMapForGroup.set(log.coasterId, coasterGroup);
      group.coasters.push(coasterGroup);
    }
    coasterGroup.lastActivityAt = Math.max(coasterGroup.lastActivityAt, log._creationTime);
    coasterGroup.riders.push({
      ...person,
      logId: log._id,
      isFirstCreditLog: log.isFirstCreditLog,
      score:
        ranking && user && user.rankingCount > 0
          ? computeRankingScore(ranking.rank, user.rankingCount)
          : null,
      rank: ranking?.rank ?? null,
      notes: log.notes ?? null,
      feedHighlights: log.feedHighlights ?? [],
    });
  }
  return [...groups.values()]
    .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
    .map((group) => ({
      ...group,
      coasters: group.coasters
        .sort((a, b) => b.lastActivityAt - a.lastActivityAt)
        .map((coaster) => ({
          ...coaster,
          riders: coaster.riders.sort(
            (a, b) => Number(b.isFirstCreditLog) - Number(a.isFirstCreditLog),
          ),
        })),
    }));
}
