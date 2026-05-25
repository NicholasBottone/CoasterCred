export type CoasterSummary = {
  _id?: string;
  source?: string;
  sourceId?: string;
  sourcePageId?: string;
  sourceUrl?: string;
  lastSyncedAt?: number;
  name: string;
  parentName?: string;
  park: string;
  location: string;
  country?: string;
  type: string;
  isMultiTrack?: boolean;
  multiTrackGroupId?: string;
  trackName?: string;
  trackIndex?: number;
  manufacturer?: string;
  product?: string;
  propulsion?: string;
  durationSeconds?: number;
  status?: string;
  heightFt?: number;
  speedMph?: number;
  lengthFt?: number;
  inversions?: number;
  yearOpened?: number;
  imageUrl?: string;
};

export type CoasterGroupSummary = {
  kind: "multiTrackGroup";
  name: string;
  parentName: string;
  park: string;
  location: string;
  country?: string;
  type: string;
  source?: string;
  sourcePageId: string;
  sourceUrl?: string;
  isMultiTrack: true;
  multiTrackGroupId: string;
  tracks: CoasterSummary[];
};

export type CoasterModalTarget = CoasterSummary | CoasterGroupSummary;

export function isCoasterGroupSummary(value: CoasterModalTarget): value is CoasterGroupSummary {
  return (value as CoasterGroupSummary).kind === "multiTrackGroup";
}

export function getCoasterDisplayName(coaster: Pick<CoasterSummary, "name">) {
  return coaster.name;
}

export function getCoasterParentName(coaster: Pick<CoasterSummary, "name" | "parentName">) {
  return coaster.parentName ?? coaster.name;
}

export function getCoasterTrackLabel(coaster: Pick<CoasterSummary, "trackName" | "trackIndex">) {
  if (coaster.trackName) return coaster.trackName;
  if (typeof coaster.trackIndex === "number") return `Track ${coaster.trackIndex + 1}`;
  return null;
}
