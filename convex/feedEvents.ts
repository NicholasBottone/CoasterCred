export const HISTORICAL_RIDE_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

export type FeedHighlight = {
  kind: "countMilestone" | "countryFirst";
  label: string;
  value?: number;
  country?: string;
};

export function getRideDateTimestamp(rideDate?: string | null) {
  if (!rideDate) {
    return Number.NaN;
  }
  return new Date(`${rideDate}T12:00:00`).getTime();
}

export function isHistoricalRideDate(
  rideDate: string | null | undefined,
  referenceTimestamp: number,
) {
  const rideDateTimestamp = getRideDateTimestamp(rideDate);
  return (
    Number.isFinite(rideDateTimestamp) &&
    referenceTimestamp - rideDateTimestamp >= HISTORICAL_RIDE_WINDOW_MS
  );
}

export function formatOrdinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) {
    return `${value}th`;
  }

  const remainder10 = value % 10;
  if (remainder10 === 1) return `${value}st`;
  if (remainder10 === 2) return `${value}nd`;
  if (remainder10 === 3) return `${value}rd`;
  return `${value}th`;
}
