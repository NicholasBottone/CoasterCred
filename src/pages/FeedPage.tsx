import { Search, RollerCoaster, Repeat2 } from "lucide-react";
import { PageHeading } from "../components/TrackMotif";
import { VisitTicket } from "../components/VisitTicket";
import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { formatDistanceToNow } from "../lib/dateUtils";
import { Avatar } from "../components/Avatar";
import { CoasterModal } from "../components/CoasterModal";
import { FeedRiderDetails } from "../components/FeedRiderDetails";
import { ParkModal } from "../components/ParkModal";
import {
  type CoasterModalTarget,
  type CoasterSummary,
} from "../lib/coasterData";
import { UserProfileModal } from "../components/UserProfileModal";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterMaterialClasses } from "../lib/badges";

type FeedTrip = FunctionReturnType<typeof api.rideLogs.getFeed>[number];
type FeedCoaster = FeedTrip["coasters"][number];
type FeedRider = FeedCoaster["riders"][number];
type SelectedCoaster = {
  coaster: CoasterModalTarget;
  initialSelectedTrackKey?: string | null;
};
type SelectedPark = { park: string; location: string };

export function FeedPage({
  onViewPublicProfile,
  onOpenSearch,
}: {
  onViewPublicProfile: (userId: string) => void;
  onOpenSearch: () => void;
}) {
  const feed = useQuery(api.rideLogs.getFeed);
  const [selectedCoaster, setSelectedCoaster] =
    useState<SelectedCoaster | null>(null);
  const [selectedPark, setSelectedPark] = useState<SelectedPark | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  if (feed === undefined) return <LoadingSpinner />;
  if (feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <RollerCoaster
          className="mb-4 h-10 w-10 text-primary"
          aria-hidden="true"
        />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">
          Your feed is empty
        </h2>
        <p className="text-gray-500 text-sm">
          Follow other enthusiasts or log your first ride to get started!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-content">
        <button
          type="button"
          onClick={onOpenSearch}
          className="mb-4 flex min-h-11 w-full items-center gap-3 border-b border-gray-200 pb-3 text-left text-sm text-gray-500 hover:text-primary dark:border-gray-800 dark:text-gray-400"
          aria-label="Search for a coaster or a member"
        >
          <Search size={18} aria-hidden="true" />
          <span>Search for a coaster or a member</span>
        </button>
        <PageHeading title="Activity Feed" motif="lift" />
        {feed.map((trip) => (
          <TripCard
            key={trip.key}
            trip={trip}
            onSelectCoaster={(coaster) => setSelectedCoaster({ coaster })}
            onSelectPark={setSelectedPark}
            onSelectUser={setSelectedUserId}
          />
        ))}
      </div>

      {selectedPark && (
        <ParkModal
          suspended={selectedCoaster !== null}
          park={selectedPark.park}
          initialLocation={selectedPark.location}
          onClose={() => setSelectedPark(null)}
          onSelectCoaster={setSelectedCoaster}
        />
      )}
      {selectedCoaster && (
        <CoasterModal
          coaster={selectedCoaster.coaster}
          initialSelectedTrackKey={selectedCoaster.initialSelectedTrackKey}
          onClose={() => setSelectedCoaster(null)}
        />
      )}
      {selectedUserId && (
        <UserProfileModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onViewProfile={(userId) => {
            setSelectedUserId(null);
            onViewPublicProfile(userId);
          }}
        />
      )}
    </>
  );
}

function TripCard({
  trip,
  onSelectCoaster,
  onSelectPark,
  onSelectUser,
}: {
  trip: FeedTrip;
  onSelectCoaster: (coaster: CoasterSummary) => void;
  onSelectPark: (park: SelectedPark) => void;
  onSelectUser: (userId: string) => void;
}) {
  const soloRider = trip.people.length === 1 ? trip.people[0] : null;

  return (
    <VisitTicket
      date={trip.rideDate}
      header={
        <>
          <button
            type="button"
            onClick={() =>
              onSelectPark({ park: trip.park, location: trip.location })
            }
            className="group block max-w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`Browse coasters at ${trip.park}`}
          >
            <h3 className="text-base font-bold text-gray-900 transition-colors group-hover:text-primary group-focus-visible:text-primary dark:text-gray-100">
              {trip.park}
            </h3>
            {trip.location && (
              <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">
                {trip.location}
              </p>
            )}
          </button>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {trip.people.length} {trip.people.length === 1 ? "rider" : "riders"}
            {trip.firstCreditCount > 0 &&
              ` · ${trip.firstCreditCount} new ${trip.firstCreditCount === 1 ? "credit" : "credits"}`}
            {trip.rerideCount > 0 &&
              ` · ${trip.rerideCount} ${trip.rerideCount === 1 ? "reride" : "rerides"}`}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            Latest log {formatDistanceToNow(trip.lastActivityAt)}
          </p>
        </>
      }
      people={
        soloRider ? (
          <button
            type="button"
            onClick={() => onSelectUser(soloRider._id)}
            className="flex max-w-[48%] shrink-0 items-center gap-2 rounded-full px-1 py-0.5 text-left transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label={`View ${soloRider.name}'s profile`}
          >
            <Avatar
              avatarUrl={soloRider.avatarUrl}
              name={soloRider.name}
              sizeClassName="h-8 w-8"
              textClassName="text-xs"
            />
            <span className="min-w-0 truncate text-xs font-semibold text-gray-800 dark:text-gray-100">
              {soloRider.name}
            </span>
          </button>
        ) : (
          <div
            className="flex shrink-0 items-center pl-2 pt-0.5"
            aria-label="Riders on this park day"
          >
            {trip.people.slice(0, 3).map((person) => (
              <button
                key={person._id}
                type="button"
                onClick={() => onSelectUser(person._id)}
                className="-ml-2 rounded-full ring-2 ring-white transition-transform hover:z-10  dark:ring-gray-900"
                aria-label={`View ${person.name}'s profile`}
              >
                <Avatar
                  avatarUrl={person.avatarUrl}
                  name={person.name}
                  sizeClassName="h-8 w-8"
                  textClassName="text-xs"
                />
              </button>
            ))}
            {trip.people.length > 3 && (
              <span className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 ring-2 ring-white dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-900">
                +{trip.people.length - 3}
              </span>
            )}
          </div>
        )
      }
    >
      {trip.coasters.map((item, index) => (
        <CoasterRow
          key={item.coaster?._id ?? `${trip.key}-${index}`}
          item={item}
          isSoloTrip={soloRider !== null}
          onSelectCoaster={onSelectCoaster}
          onSelectUser={onSelectUser}
        />
      ))}
    </VisitTicket>
  );
}

function CoasterRow({
  item,
  isSoloTrip,
  onSelectCoaster,
  onSelectUser,
}: {
  item: FeedCoaster;
  isSoloTrip: boolean;
  onSelectCoaster: (coaster: CoasterSummary) => void;
  onSelectUser: (userId: string) => void;
}) {
  const soloRide =
    isSoloTrip && item.riders.length === 1 ? item.riders[0] : null;

  return (
    <section className="ride-row">
      <div className="flex items-center gap-2">
        {item.coaster ? (
          <button
            type="button"
            onClick={() => onSelectCoaster(item.coaster!)}
            className="min-w-0 flex-1 text-left text-sm font-semibold text-gray-900 hover:text-primary dark:text-gray-100 dark:hover:text-primary"
          >
            {item.coaster.name}
          </button>
        ) : (
          <span className="min-w-0 flex-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            Unknown coaster
          </span>
        )}
        {item.coaster && (
          <span className={getCoasterMaterialClasses(item.coaster.type)}>
            {item.coaster.type}
          </span>
        )}
        {soloRide && (
          <>
            {!soloRide.isFirstCreditLog && (
              <span className="reride" aria-label="Reride">
                <Repeat2 aria-hidden="true" />
              </span>
            )}
            <RiderScore rider={soloRide} />
          </>
        )}
      </div>
      {!soloRide && (
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          {item.riders.map((rider) => (
            <RiderChip
              key={rider.logId}
              rider={rider}
              onSelectUser={onSelectUser}
            />
          ))}
        </div>
      )}
      {item.riders.some(
        (rider) => rider.feedHighlights.length > 0 || rider.notes,
      ) && (
        <div className="mt-2 flex flex-col gap-1.5">
          {item.riders.map((rider) => (
            <FeedRiderDetails
              key={rider.logId}
              name={rider.name}
              badges={rider.feedHighlights.map((highlight) => ({
                label: highlight.label,
                variant: highlight.kind,
                country: highlight.country,
                value: highlight.value,
              }))}
              notes={rider.notes}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RiderChip({
  rider,
  onSelectUser,
}: {
  rider: FeedRider;
  onSelectUser: (userId: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelectUser(rider._id)}
      className="rider-inline"
      aria-label={`${rider.name}${rider.isFirstCreditLog ? "" : ", reride"}${rider.score !== null ? `, score ${rider.score.toFixed(1)} out of 10` : ""}`}
    >
      <Avatar
        avatarUrl={rider.avatarUrl}
        name={rider.name}
        sizeClassName={
          rider.isFirstCreditLog ? "h-7 w-7" : "h-7 w-7 grayscale opacity-80"
        }
        textClassName="text-[10px]"
      />
      <span
        className={`max-w-24 truncate text-xs font-semibold ${rider.isFirstCreditLog ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
      >
        {rider.name}
      </span>
      {!rider.isFirstCreditLog && (
        <span className="reride">
          <Repeat2 aria-hidden="true" />
          <span>Reride</span>
        </span>
      )}
      <RiderScore rider={rider} />
    </button>
  );
}

function RiderScore({ rider }: { rider: FeedRider }) {
  if (rider.score !== null) {
    return (
      <ScoreBadge
        score={rider.score}
        size="sm"
        muted={!rider.isFirstCreditLog}
        className="!h-8 !w-8 !text-[11px]"
      />
    );
  }
  if (rider.rank !== null) {
    return (
      <span
        className={`rounded-full border px-2 py-1 text-[11px] font-medium ${rider.isFirstCreditLog ? "border-primary/20 text-primary dark:border-primary/30" : "border-gray-300/60 text-gray-500 dark:border-gray-700 dark:text-gray-400"}`}
      >
        #{rider.rank}
      </span>
    );
  }
  return null;
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
