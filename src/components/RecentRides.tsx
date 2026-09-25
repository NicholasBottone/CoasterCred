import { Fragment } from "react";
import type { CoasterSummary } from "../lib/coasterData";
import { formatDate } from "../lib/dateUtils";

type RecentRide = {
  _id: string;
  rideDate?: string | null;
  coaster?: CoasterSummary | null;
  notes?: string | null;
};

export function RecentRides({
  rides,
  onSelectCoaster,
}: {
  rides: RecentRide[];
  onSelectCoaster?: (coaster: CoasterSummary) => void;
}) {
  return (
    <aside className="recent-rides">
      <h2>Recent Rides</h2>
      {rides.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No rides logged yet
        </p>
      )}
      {rides.map((ride, index) => (
        <Fragment key={ride._id}>
          {(index === 0 || ride.rideDate !== rides[index - 1].rideDate) && (
            <p className="recent-date">{formatDate(ride.rideDate)}</p>
          )}
          <button
            type="button"
            className="recent-ride"
            disabled={!ride.coaster || !onSelectCoaster}
            onClick={() => ride.coaster && onSelectCoaster?.(ride.coaster)}
          >
            <strong>{ride.coaster?.name ?? "Unknown coaster"}</strong>
            <span>{ride.coaster?.park}</span>
            {ride.notes && <span className="recent-note">{ride.notes}</span>}
          </button>
        </Fragment>
      ))}
    </aside>
  );
}
