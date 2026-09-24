import { useState } from "react";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../convex/_generated/api";
import { formatDate, formatDistanceToNow } from "../lib/dateUtils";
import { Avatar } from "../components/Avatar";
import { CoasterModal } from "../components/CoasterModal";
import { FeedRiderDetails } from "../components/FeedRiderDetails";
import { ParkModal } from "../components/ParkModal";
import { type CoasterModalTarget, type CoasterSummary } from "../lib/coasterData";
import { UserProfileModal } from "../components/UserProfileModal";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterTypeBadgeClasses } from "../lib/badges";

type FeedTrip = FunctionReturnType<typeof api.rideLogs.getFeed>[number];
type FeedCoaster = FeedTrip["coasters"][number];
type FeedRider = FeedCoaster["riders"][number];
type SelectedCoaster = { coaster: CoasterModalTarget; initialSelectedTrackKey?: string | null };
type SelectedPark = { park: string; location: string };

export function FeedPage({
  onViewPublicProfile,
  onOpenSearch,
}: {
  onViewPublicProfile: (userId: string) => void;
  onOpenSearch: () => void;
}) {
  const feed = useQuery(api.rideLogs.getFeed);
  const [selectedCoaster, setSelectedCoaster] = useState<SelectedCoaster | null>(null);
  const [selectedPark, setSelectedPark] = useState<SelectedPark | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  if (feed === undefined) return <LoadingSpinner />;
  if (feed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="text-5xl mb-4">🎢</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Your feed is empty</h2>
        <p className="text-gray-500 text-sm">Follow other enthusiasts or log your first ride to get started!</p>
      </div>
    );
  }

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={onOpenSearch}
          className="surface-card flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm text-gray-500 transition-colors hover:border-primary/30 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          aria-label="Search for a coaster or a member"
        >
          <span aria-hidden="true" className="text-base leading-none">🔍</span>
          <span>Search for a coaster or a member</span>
        </button>
        <h2 className="ui-copy-disabled text-lg font-bold text-gray-800 dark:text-gray-100">Activity Feed</h2>
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
  return (
    <article className="surface-card rounded-xl p-4">
      <div className="flex items-start gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onSelectPark({ park: trip.park, location: trip.location })}
            className="group block max-w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            aria-label={`Browse coasters at ${trip.park}`}
          >
            <h3 className="text-base font-bold text-gray-900 transition-colors group-hover:text-primary group-focus-visible:text-primary dark:text-gray-100">
              {trip.park}
            </h3>
            {trip.location && (
              <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">{trip.location}</p>
            )}
          </button>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {formatDate(trip.rideDate)} · {trip.people.length} {trip.people.length === 1 ? "rider" : "riders"} · {trip.firstCreditCount} new {trip.firstCreditCount === 1 ? "credit" : "credits"}
            {trip.rerideCount > 0 && ` · ${trip.rerideCount} ${trip.rerideCount === 1 ? "reride" : "rerides"}`}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
            Latest log {formatDistanceToNow(trip.lastActivityAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center pl-2 pt-0.5" aria-label="Riders on this park day">
          {trip.people.slice(0, 3).map((person) => (
            <button
              key={person._id}
              type="button"
              onClick={() => onSelectUser(person._id)}
              className="-ml-2 rounded-full ring-2 ring-white transition-transform hover:z-10 hover:-translate-y-0.5 dark:ring-gray-900"
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
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {trip.coasters.map((item, index) => (
          <CoasterRow
            key={item.coaster?._id ?? `${trip.key}-${index}`}
            item={item}
            onSelectCoaster={onSelectCoaster}
            onSelectUser={onSelectUser}
          />
        ))}
      </div>
    </article>
  );
}

function CoasterRow({
  item,
  onSelectCoaster,
  onSelectUser,
}: {
  item: FeedCoaster;
  onSelectCoaster: (coaster: CoasterSummary) => void;
  onSelectUser: (userId: string) => void;
}) {
  return (
    <section className="py-3 last:pb-0">
      <div className="flex items-center gap-2">
        {item.coaster ? (
          <button
            type="button"
            onClick={() => onSelectCoaster(item.coaster!)}
            className="min-w-0 flex-1 text-left text-sm font-bold text-gray-900 hover:text-primary dark:text-gray-100 dark:hover:text-primary"
          >
            {item.coaster.name}
          </button>
        ) : (
          <span className="min-w-0 flex-1 text-sm font-bold text-gray-900 dark:text-gray-100">Unknown coaster</span>
        )}
        {item.coaster && (
          <span className={getCoasterTypeBadgeClasses(item.coaster.type)}>{item.coaster.type}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {item.riders.map((rider) => (
          <RiderChip key={rider.logId} rider={rider} onSelectUser={onSelectUser} />
        ))}
      </div>
      {item.riders.some((rider) => rider.feedHighlights.length > 0 || rider.notes) && (
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

function RiderChip({ rider, onSelectUser }: { rider: FeedRider; onSelectUser: (userId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelectUser(rider._id)}
      className={`flex items-center gap-1.5 rounded-full py-1 pl-1 pr-1.5 text-left transition-colors ${rider.isFirstCreditLog ? "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800/80 dark:hover:bg-gray-800" : "border border-dashed border-gray-200 bg-gray-50/70 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800/40 dark:hover:bg-gray-800"}`}
      aria-label={`${rider.name}${rider.isFirstCreditLog ? "" : ", reride"}${rider.score !== null ? `, score ${rider.score.toFixed(1)} out of 10` : ""}`}
    >
      <Avatar
        avatarUrl={rider.avatarUrl}
        name={rider.name}
        sizeClassName="h-7 w-7"
        textClassName="text-[10px]"
      />
      <span className="max-w-24 truncate text-xs font-semibold text-gray-800 dark:text-gray-100">{rider.name}</span>
      {!rider.isFirstCreditLog && <span className="text-[11px] text-gray-500 dark:text-gray-400">↻ Reride</span>}
      {rider.score !== null ? (
        <ScoreBadge score={rider.score} size="sm" className="!h-8 !w-8 !text-[11px]" />
      ) : rider.rank !== null ? (
        <span className="rounded-full border border-primary/20 px-2 py-1 text-[11px] font-medium text-primary dark:border-primary/30">
          #{rider.rank}
        </span>
      ) : null}
    </button>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-20">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
