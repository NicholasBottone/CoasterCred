import {
  CoasterDetailHeader,
  CoasterSpecifications,
  DetailMetric as Metric,
  DetailSection,
  ParkCoasterRow,
} from "../components/DetailSheet";
import { Home, LockKeyhole, Repeat2 } from "lucide-react";
import { PageHeading } from "../components/TrackMotif";
import { VisitTicket } from "../components/VisitTicket";
import { ProfileSummary } from "../components/ProfileSummary";
import { useRef, useState, type ReactNode } from "react";
import { SignInForm } from "../SignInForm";
import { AppShell, type Tab } from "../components/AppShell";
import { Avatar } from "../components/Avatar";
import { FeedRiderDetails } from "../components/FeedRiderDetails";
import { ModalCloseButton, ModalContainer } from "../components/ModalContainer";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterMaterialClasses } from "../lib/badges";
import { formatDate } from "../lib/dateUtils";
import {
  demoCoasters,
  demoFeed,
  demoLeaderboard,
  demoRankings,
  demoUsers,
  type DemoCoaster,
  type DemoUser,
} from "./demoData";

export function DemoApp() {
  const [tab, setTab] = useState<Tab>("feed");
  const [authOpen, setAuthOpen] = useState(false);
  const [selectedCoaster, setSelectedCoaster] = useState<DemoCoaster | null>(
    null,
  );
  const [selectedPark, setSelectedPark] = useState<{
    park: string;
    location: string;
  } | null>(null);
  const [selectedUser, setSelectedUser] = useState<DemoUser | null>(null);

  const openAuth = () => setAuthOpen(true);

  return (
    <>
      <AppShell
        tab={tab}
        onSelectTab={setTab}
        headerAction={
          <button
            onClick={openAuth}
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-white  transition-colors hover:bg-primary-hover "
          >
            Sign in
          </button>
        }
        banner={
          <div className="border-b border-primary/15 bg-primary/5 px-4 py-2 text-center text-xs font-medium text-primary dark:border-primary/20 dark:bg-primary/10">
            Rank coasters head-to-head. Track every ride. See how your crew
            stacks up.
          </div>
        }
        bottomBanner={
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm">
            <span className="text-gray-700 dark:text-gray-200">
              You’re viewing a demo. Sign in to unlock the full CoasterCred
              experience.
            </span>
            <button
              type="button"
              onClick={openAuth}
              className="min-h-11 rounded px-2 font-semibold text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        }
      >
        {tab === "feed" && (
          <DemoFeedPage
            onOpenAuth={openAuth}
            onOpenCoaster={setSelectedCoaster}
            onOpenPark={setSelectedPark}
            onOpenUser={setSelectedUser}
          />
        )}
        {tab === "myList" && <DemoMyListPage onOpenAuth={openAuth} />}
        {tab === "search" && (
          <LockedDemoPage
            title="Search Coasters"
            body="Sign in to search Coasterpedia and log your rides."
            onOpenAuth={openAuth}
          />
        )}
        {tab === "rankings" && <DemoRankingsPage onOpenAuth={openAuth} />}
        {tab === "profile" && (
          <LockedDemoPage
            title="Build your profile"
            body="Create your coaster profile, follow friends, and track your rankings."
            onOpenAuth={openAuth}
          />
        )}
      </AppShell>

      {selectedPark && (
        <DemoParkModal
          suspended={selectedCoaster !== null || authOpen}
          park={selectedPark.park}
          location={selectedPark.location}
          onClose={() => setSelectedPark(null)}
          onOpenCoaster={setSelectedCoaster}
        />
      )}
      {selectedCoaster && (
        <DemoCoasterModal
          coaster={selectedCoaster}
          onClose={() => setSelectedCoaster(null)}
          onOpenAuth={openAuth}
        />
      )}
      {selectedUser && (
        <DemoUserModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onOpenAuth={openAuth}
        />
      )}
      {authOpen && <AuthPromptModal onClose={() => setAuthOpen(false)} />}
    </>
  );
}

function DemoFeedPage({
  onOpenAuth,
  onOpenCoaster,
  onOpenPark,
  onOpenUser,
}: {
  onOpenAuth: () => void;
  onOpenCoaster: (coaster: DemoCoaster) => void;
  onOpenPark: (park: { park: string; location: string }) => void;
  onOpenUser: (user: DemoUser) => void;
}) {
  type DemoFeedItem = (typeof demoFeed)[number];
  type DemoTrip = {
    key: string;
    park: string;
    location: string;
    rideDate: string;
    people: DemoUser[];
    coasters: Array<{ coaster: DemoCoaster; rides: DemoFeedItem[] }>;
  };
  const trips = new Map<string, DemoTrip>();
  for (const item of demoFeed) {
    const key = JSON.stringify([
      item.rideDate,
      item.coaster.park,
      item.coaster.location,
    ]);
    let trip = trips.get(key);
    if (!trip) {
      trip = {
        key,
        park: item.coaster.park,
        location: item.coaster.location,
        rideDate: item.rideDate,
        people: [],
        coasters: [],
      };
      trips.set(key, trip);
    }
    if (!trip.people.includes(item.user)) trip.people.push(item.user);
    let coaster = trip.coasters.find((entry) => entry.coaster === item.coaster);
    if (!coaster) {
      coaster = { coaster: item.coaster, rides: [] };
      trip.coasters.push(coaster);
    }
    coaster.rides.push(item);
  }

  return (
    <div className="page-content">
      <PageHeading title="Activity Feed" motif="lift" />
      <div className="mb-4">
        <DemoInlineCta onClick={onOpenAuth} />
      </div>
      {[...trips.values()].map((trip) => {
        const creditCount = trip.coasters.reduce(
          (count, coaster) =>
            count +
            coaster.rides.filter((ride) => ride.isFirstCreditLog).length,
          0,
        );
        const rerideCount = trip.coasters.reduce(
          (count, coaster) =>
            count +
            coaster.rides.filter((ride) => !ride.isFirstCreditLog).length,
          0,
        );
        const soloRider = trip.people.length === 1 ? trip.people[0] : null;
        return (
          <VisitTicket
            key={trip.key}
            date={trip.rideDate}
            header={
              <>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPark({ park: trip.park, location: trip.location })
                  }
                  className="group block max-w-full rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-label={`Browse coasters at ${trip.park}`}
                >
                  <h3 className="text-base font-bold text-gray-900 transition-colors group-hover:text-primary group-focus-visible:text-primary dark:text-gray-100">
                    {trip.park}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-700 dark:text-gray-300">
                    {trip.location}
                  </p>
                </button>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {trip.people.length}{" "}
                  {trip.people.length === 1 ? "rider" : "riders"}
                  {creditCount > 0 &&
                    ` · ${creditCount} new ${creditCount === 1 ? "credit" : "credits"}`}
                  {rerideCount > 0 &&
                    ` · ${rerideCount} ${rerideCount === 1 ? "reride" : "rerides"}`}
                </p>
                <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">
                  Latest log {trip.coasters[0]?.rides[0]?.relativeTime}
                </p>
              </>
            }
            people={
              soloRider ? (
                <button
                  type="button"
                  onClick={() => onOpenUser(soloRider)}
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
                      key={person.name}
                      type="button"
                      onClick={() => onOpenUser(person)}
                      className="-ml-2 rounded-full ring-2 ring-white dark:ring-gray-900"
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
                </div>
              )
            }
          >
            {trip.coasters.map(({ coaster, rides }) => (
              <section key={coaster.name} className="ride-row">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenCoaster(coaster)}
                    className="min-w-0 flex-1 text-left text-sm font-semibold text-gray-900 hover:text-primary dark:text-gray-100"
                  >
                    {coaster.name}
                  </button>
                  <span className={getCoasterMaterialClasses(coaster.type)}>
                    {coaster.type}
                  </span>
                  {soloRider && rides.length === 1 && (
                    <>
                      {!rides[0].isFirstCreditLog && (
                        <span className="reride" aria-label="Reride">
                          <Repeat2 aria-hidden="true" />
                        </span>
                      )}
                      <ScoreBadge
                        score={rides[0].score}
                        size="sm"
                        muted={!rides[0].isFirstCreditLog}
                        className="!h-8 !w-8 !text-[11px]"
                      />
                    </>
                  )}
                </div>
                {(!soloRider || rides.length !== 1) && (
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {[...rides]
                      .sort(
                        (a, b) =>
                          Number(b.isFirstCreditLog) -
                          Number(a.isFirstCreditLog),
                      )
                      .map((ride) => (
                        <button
                          key={ride.id}
                          type="button"
                          onClick={() => onOpenUser(ride.user)}
                          className="rider-inline"
                          aria-label={`${ride.user.name}${ride.isFirstCreditLog ? "" : ", reride"}, score ${ride.score.toFixed(1)} out of 10`}
                        >
                          <Avatar
                            avatarUrl={ride.user.avatarUrl}
                            name={ride.user.name}
                            sizeClassName={
                              ride.isFirstCreditLog
                                ? "h-7 w-7"
                                : "h-7 w-7 grayscale opacity-80"
                            }
                            textClassName="text-[10px]"
                          />
                          <span
                            className={`max-w-24 truncate text-xs font-semibold ${ride.isFirstCreditLog ? "text-gray-800 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}
                          >
                            {ride.user.name}
                          </span>
                          {!ride.isFirstCreditLog && (
                            <span className="reride">
                              <Repeat2 aria-hidden="true" />
                              <span>Reride</span>
                            </span>
                          )}
                          <ScoreBadge
                            score={ride.score}
                            size="sm"
                            muted={!ride.isFirstCreditLog}
                            className="!h-8 !w-8 !text-[11px]"
                          />
                        </button>
                      ))}
                  </div>
                )}
                {rides.map((ride) =>
                  ride.badges.length > 0 || ride.notes ? (
                    <div key={ride.id} className="mt-2">
                      <FeedRiderDetails
                        name={ride.user.name}
                        badges={ride.badges.map((badge) => ({
                          label: badge.label,
                          variant: badge.tone,
                          value:
                            "value" in badge && typeof badge.value === "number"
                              ? badge.value
                              : undefined,
                        }))}
                        notes={ride.notes}
                      />
                    </div>
                  ) : null,
                )}
              </section>
            ))}
          </VisitTicket>
        );
      })}
    </div>
  );
}

function DemoMyListPage({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <div className="page-content">
      <PageHeading title="My List" motif="roll" />
      <DemoPreviewGate
        title="Build your own list"
        body="Sign in to log rides and rank your coasters."
        onOpenAuth={onOpenAuth}
      >
        {demoRankings.map((item) => (
          <div
            key={item.rank}
            className="flat-row flex items-center gap-3 text-left"
          >
            <div className="rank-number shrink-0 text-sm">{item.rank}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                {item.coaster.name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {item.coaster.park}
              </p>
            </div>
            <span className={getCoasterMaterialClasses(item.coaster.type)}>
              {item.coaster.type}
            </span>
            <ScoreBadge score={item.score} size="sm" />
          </div>
        ))}
      </DemoPreviewGate>
    </div>
  );
}

function DemoRankingsPage({ onOpenAuth }: { onOpenAuth: () => void }) {
  return (
    <div className="page-content">
      <PageHeading title="Rankings" motif="topHat" />
      <DemoPreviewGate
        title="See where you stand"
        body="Sign in to log rides and join the rankings."
        onOpenAuth={onOpenAuth}
      >
        {demoLeaderboard.map((entry) => (
          <div
            key={entry.rank}
            className="flat-row flex items-center gap-3 text-left"
          >
            <div className="rank-number shrink-0 text-sm">{entry.rank}</div>
            <Avatar
              avatarUrl={entry.user.avatarUrl}
              name={entry.user.name}
              sizeClassName="w-10 h-10"
              textClassName="text-base"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                {entry.user.name}
              </p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                Home park: {entry.homepark}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Last ride {entry.lastRide}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-primary">
                {entry.rideCount}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                30d
              </p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                {entry.totalRideCount} total
              </p>
            </div>
          </div>
        ))}
      </DemoPreviewGate>
    </div>
  );
}

function DemoPreviewGate({
  title,
  body,
  onOpenAuth,
  children,
}: {
  title: string;
  body: string;
  onOpenAuth: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative min-h-[440px]">
      <div
        aria-hidden="true"
        className="flex flex-col gap-2 opacity-35 blur-[1px]"
      >
        {children}
      </div>
      <div className="absolute inset-x-0 top-8 flex justify-center px-2 sm:top-12">
        <div className="surface-card w-full max-w-sm p-6 text-center shadow-xl">
          <LockKeyhole
            className="mx-auto mb-4 h-8 w-8 text-primary"
            aria-hidden="true"
          />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            {body}
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-6 min-h-11 rounded bg-primary px-5 py-2 text-sm font-semibold transition-colors hover:bg-primary-hover"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

function LockedDemoPage({
  title,
  body,
  onOpenAuth,
}: {
  title: string;
  body: string;
  onOpenAuth: () => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <div className="surface-card p-6 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary">
          <LockKeyhole
            className="mx-auto h-8 w-8 text-primary"
            aria-hidden="true"
          />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          {title}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{body}</p>
        <button
          onClick={onOpenAuth}
          className="mt-6 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover "
        >
          Sign in to continue
        </button>
      </div>
    </div>
  );
}

function AuthPromptModal({ onClose }: { onClose: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <ModalContainer onClose={onClose} scrollRef={scrollRef}>
      <div className="mb-4 text-center">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Sign in to make it yours
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Start logging rides, building your list, and following other coaster
          fans.
        </p>
      </div>
      <SignInForm />
    </ModalContainer>
  );
}

function DemoParkModal({
  park,
  location,
  onClose,
  onOpenCoaster,
  suspended,
}: {
  suspended?: boolean;
  park: string;
  location: string;
  onClose: () => void;
  onOpenCoaster: (coaster: DemoCoaster) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const coasters = demoCoasters.filter((coaster) => coaster.park === park);

  return (
    <ModalContainer
      onClose={onClose}
      maxWidth="2xl"
      scrollRef={scrollRef}
      label={`${park} coaster directory`}
      contentClassName="park-sheet"
      suspended={suspended}
    >
      <div className="detail-header">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="detail-title">{park}</h3>
            <span className="detail-muted text-xs">
              {coasters.length} coaster{coasters.length === 1 ? "" : "s"}
            </span>
          </div>
          {location && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {location}
            </p>
          )}
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>
      <div className="park-directory">
        {coasters.map((coaster) => (
          <ParkCoasterRow
            key={coaster.name}
            name={coaster.name}
            material={coaster.type}
            score={coaster.score}
            onClick={() => onOpenCoaster(coaster)}
          />
        ))}
      </div>
    </ModalContainer>
  );
}

function DemoCoasterModal({
  coaster,
  onClose,
  onOpenAuth,
}: {
  coaster: DemoCoaster;
  onClose: () => void;
  onOpenAuth: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isLogPromptOpen, setIsLogPromptOpen] = useState(false);

  return (
    <>
      <ModalContainer
        onClose={onClose}
        maxWidth="2xl"
        scrollRef={scrollRef}
        label={coaster.name}
        contentClassName="coaster-sheet"
        suspended={isLogPromptOpen}
      >
        <CoasterDetailHeader
          title={coaster.name}
          location={`${coaster.park} · ${coaster.location}`}
          onClose={onClose}
          metadata={
            <>
              <span className={getCoasterMaterialClasses(coaster.type)}>
                {coaster.type}
              </span>
              <ScoreBadge score={coaster.score} size="sm" />
            </>
          }
          logAction={
            <button
              type="button"
              onClick={() => setIsLogPromptOpen(true)}
              aria-label="Log ride"
              className="detail-log-action"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
              >
                <path
                  d="M12 5V19M5 12H19"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Log</span>
            </button>
          }
        />

        <DetailSection title="Specifications">
          <CoasterSpecifications coaster={coaster} />
        </DetailSection>

        <div className="detail-social">
          <section className="detail-section">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                On CoasterCred
              </h4>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                Community snapshot
              </span>
            </div>
            <dl className="detail-metrics">
              <Metric label="Unique riders" value={coaster.uniqueRiders} />
              <Metric label="Total logs" value={coaster.totalLogs} />
              <Metric
                label="Followed riders"
                value={coaster.friendRatings.length}
              />
              <Metric
                label="Friends avg"
                value={coaster.friendAverage.toFixed(1)}
              />
            </dl>
          </section>

          <section className="detail-section">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Friends who rode this
              </h4>
              <span className="text-[11px] text-gray-400 dark:text-gray-500">
                Preview
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {coaster.friendRatings.map((entry) => (
                <div
                  key={entry.user.name}
                  className="detail-list-row flex items-center gap-3"
                >
                  <Avatar
                    avatarUrl={entry.user.avatarUrl}
                    name={entry.user.name}
                    sizeClassName="w-9 h-9"
                    textClassName="text-sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {entry.user.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      #{entry.rank} in their list
                    </p>
                  </div>
                  <ScoreBadge score={entry.score} size="sm" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </ModalContainer>
      {isLogPromptOpen && (
        <DemoLogRidePromptModal
          coaster={coaster}
          onClose={() => setIsLogPromptOpen(false)}
          onSignIn={() => {
            setIsLogPromptOpen(false);
            onClose();
            onOpenAuth();
          }}
        />
      )}
    </>
  );
}

function DemoLogRidePromptModal({
  coaster,
  onClose,
  onSignIn,
}: {
  coaster: DemoCoaster;
  onClose: () => void;
  onSignIn: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <ModalContainer
      onClose={onClose}
      scrollRef={scrollRef}
      overlayClassName="z-[60]"
      label="Log Ride"
    >
      <div className="detail-header">
        <div className="min-w-0">
          <h4 className="detail-title">Log Ride</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {coaster.name} · {coaster.park}
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Sign in to log this coaster, compare it head-to-head, and add it to your
        rankings.
      </p>

      <button
        type="button"
        onClick={onSignIn}
        className="mt-4 w-full rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover "
      >
        Sign in to log ride
      </button>
    </ModalContainer>
  );
}

function DemoUserModal({
  user,
  onClose,
  onOpenAuth,
}: {
  user: DemoUser;
  onClose: () => void;
  onOpenAuth: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <ModalContainer onClose={onClose} scrollRef={scrollRef}>
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Profile
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Community preview
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <div className="mb-4 flex items-start gap-4">
        <Avatar
          avatarUrl={user.avatarUrl}
          name={user.name}
          sizeClassName="w-16 h-16"
          textClassName="text-2xl"
        />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">
            {user.name}
          </h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            <Home className="inline h-3.5 w-3.5" aria-hidden="true" />{" "}
            {user.homepark}
          </p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {user.bio}
          </p>
        </div>
      </div>

      <ProfileSummary count={user.uniqueCoasters} topName={user.topCoaster} />

      <button
        onClick={() => {
          onClose();
          onOpenAuth();
        }}
        className="w-full rounded-md bg-primary py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-hover "
      >
        Sign in to follow riders
      </button>
    </ModalContainer>
  );
}

function DemoInlineCta({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-11 text-xs font-medium text-primary hover:underline"
    >
      Sign in to start
    </button>
  );
}
