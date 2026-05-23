import { useRef, useState } from "react";
import { SignInForm } from "../SignInForm";
import { AppShell, type Tab } from "../components/AppShell";
import { Avatar } from "../components/Avatar";
import { ModalCloseButton, ModalContainer } from "../components/ModalContainer";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterTypeBadgeClasses, getRideEventBadgeClasses } from "../lib/badges";
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
  const [selectedCoaster, setSelectedCoaster] = useState<DemoCoaster | null>(null);
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
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow"
          >
            Sign in
          </button>
        }
        banner={
          <div className="border-b border-primary/15 bg-primary/5 px-4 py-2 text-center text-xs font-medium text-primary dark:border-primary/20 dark:bg-primary/10">
            Rank coasters head-to-head. Track every ride. See how your crew stacks up.
          </div>
        }
      >
        {tab === "feed" && (
          <DemoFeedPage
            onOpenAuth={openAuth}
            onOpenCoaster={setSelectedCoaster}
            onOpenUser={setSelectedUser}
          />
        )}
        {tab === "myList" && (
          <DemoMyListPage onOpenAuth={openAuth} onOpenCoaster={setSelectedCoaster} />
        )}
        {tab === "search" && (
          <LockedDemoPage
            title="Search Coasters"
            body="Sign in to search Coasterpedia and log your rides."
            onOpenAuth={openAuth}
          />
        )}
        {tab === "rankings" && (
          <DemoRankingsPage onOpenAuth={openAuth} onOpenUser={setSelectedUser} />
        )}
        {tab === "profile" && (
          <LockedDemoPage
            title="Build your profile"
            body="Create your coaster profile, follow friends, and track your rankings."
            onOpenAuth={openAuth}
          />
        )}
      </AppShell>

      {authOpen && <AuthPromptModal onClose={() => setAuthOpen(false)} />}
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
    </>
  );
}

function DemoFeedPage({
  onOpenAuth,
  onOpenCoaster,
  onOpenUser,
}: {
  onOpenAuth: () => void;
  onOpenCoaster: (coaster: DemoCoaster) => void;
  onOpenUser: (user: DemoUser) => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-4 flex flex-col gap-3">
      <div className="flex items-end justify-between">
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Activity Feed</h2>
        <DemoInlineCta onClick={onOpenAuth} />
      </div>
      {demoFeed.map((item) => (
        <div key={item.id} className="surface-card interactive-lift rounded-xl p-4">
          <div className="mb-3 flex items-center gap-3">
            <button
              onClick={() => onOpenUser(item.user)}
              className="flex min-w-0 items-center gap-3 rounded-xl px-1 py-1 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
            >
              <Avatar
                avatarUrl={item.user.avatarUrl}
                name={item.user.name}
                sizeClassName="w-9 h-9"
                textClassName="text-sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{item.user.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{item.relativeTime}</p>
              </div>
            </button>
            <div className={`ml-auto ${getRideEventBadgeClasses(item.badgeTone)}`}>{item.badge}</div>
          </div>
          <button onClick={() => onOpenCoaster(item.coaster)} className="interactive-lift w-full surface-subtle p-3 text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 dark:text-gray-100">{item.coaster.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{item.coaster.park} · {item.coaster.location}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={getCoasterTypeBadgeClasses(item.coaster.type)}>{item.coaster.type}</span>
                <ScoreBadge score={item.score} size="sm" />
              </div>
            </div>
            <p className="mt-2 text-sm italic text-gray-600 dark:text-gray-300">"{item.notes}"</p>
          </button>
        </div>
      ))}
    </div>
  );
}

function DemoMyListPage({
  onOpenAuth,
  onOpenCoaster,
}: {
  onOpenAuth: () => void;
  onOpenCoaster: (coaster: DemoCoaster) => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">My List</h2>
          <p className="mb-0 mt-1 text-xs text-gray-400 dark:text-gray-500">
            Head-to-head logging builds your list. Use arrows here for quick manual tweaks.
          </p>
        </div>
        <DemoInlineCta onClick={onOpenAuth} />
      </div>
      <div className="flex flex-col gap-2">
        {demoRankings.map((item) => (
          <button
            key={item.rank}
            onClick={() => onOpenCoaster(item.coaster)}
            className="surface-card interactive-lift rounded-xl p-3 flex items-center gap-3 text-left"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {item.rank}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{item.coaster.name}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">{item.coaster.park}</p>
            </div>
            <span className={getCoasterTypeBadgeClasses(item.coaster.type)}>{item.coaster.type}</span>
            <ScoreBadge score={item.score} size="sm" />
          </button>
        ))}
      </div>
    </div>
  );
}

function DemoRankingsPage({
  onOpenAuth,
  onOpenUser,
}: {
  onOpenAuth: () => void;
  onOpenUser: (user: DemoUser) => void;
}) {
  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">Rankings</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500">Most coaster credits in the last 30 days</p>
        </div>
        <DemoInlineCta onClick={onOpenAuth} />
      </div>
      <div className="flex flex-col gap-2">
        {demoLeaderboard.map((entry) => (
          <button
            key={entry.rank}
            onClick={() => onOpenUser(entry.user)}
            className="surface-card interactive-lift rounded-xl p-4 flex items-center gap-3 text-left"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {entry.rank}
            </div>
            <Avatar
              avatarUrl={entry.user.avatarUrl}
              name={entry.user.name}
              sizeClassName="w-10 h-10"
              textClassName="text-base"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{entry.user.name}</p>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">Home park: {entry.homepark}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Last ride {entry.lastRide}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-bold text-primary">{entry.rideCount}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">30d</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">{entry.totalRideCount} total</p>
            </div>
          </button>
        ))}
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
          🔐
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{body}</p>
        <button
          onClick={onOpenAuth}
          className="mt-6 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md"
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
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Sign in to make it yours</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Start logging rides, building your list, and following other coaster fans.
        </p>
      </div>
      <SignInForm />
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
    <ModalContainer onClose={onClose} maxWidth="2xl" scrollRef={scrollRef}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">{coaster.name}</h3>
            <span className={getCoasterTypeBadgeClasses(coaster.type)}>{coaster.type}</span>
            <ScoreBadge score={coaster.score} size="sm" />
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{coaster.park} · {coaster.location}</p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLogPromptOpen(true)}
            aria-label="Log ride"
            className="inline-flex h-11 flex-none items-center gap-1.5 self-start rounded-full border border-primary/20 bg-primary/5 px-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 active:bg-primary/15 dark:border-primary/30 dark:bg-primary/10"
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
          <ModalCloseButton onClose={onClose} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Stat label="Height" value={coaster.heightFt ? `${coaster.heightFt}ft` : "—"} />
        <Stat label="Speed" value={coaster.speedMph ? `${coaster.speedMph}mph` : "—"} />
        <Stat label="Inversions" value={coaster.inversions ?? "—"} />
        <Stat label="Length" value={coaster.lengthFt ? `${coaster.lengthFt}ft` : "—"} />
        <Stat label="Opened" value={coaster.yearOpened ?? "—"} />
        <Stat label="Maker" value={coaster.manufacturer ?? "—"} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="surface-subtle p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">In CoasterCred</h4>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Community snapshot</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Unique riders" value={coaster.uniqueRiders} />
            <Metric label="Total logs" value={coaster.totalLogs} />
            <Metric label="Followed riders" value={coaster.friendRatings.length} />
            <Metric label="Friends avg" value={coaster.friendAverage.toFixed(1)} />
          </div>
        </section>

        <section className="surface-subtle p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Friends who rode this</h4>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">Preview</span>
          </div>
          <div className="flex flex-col gap-2">
            {coaster.friendRatings.map((entry) => (
              <div key={entry.user.name} className="surface-subtle flex items-center gap-3 px-3 py-3">
                <Avatar avatarUrl={entry.user.avatarUrl} name={entry.user.name} sizeClassName="w-9 h-9" textClassName="text-sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{entry.user.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">#{entry.rank} in their list</p>
                </div>
                <ScoreBadge score={entry.score} size="sm" />
              </div>
            ))}
          </div>
        </section>
      </div>

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
    </ModalContainer>
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
      contentClassName="shadow-2xl"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h4 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">Log Ride</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{coaster.name} · {coaster.park}</p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Sign in to log this coaster, compare it head-to-head, and add it to your rankings.
      </p>

      <button
        type="button"
        onClick={onSignIn}
        className="mt-4 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md"
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
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Profile</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">Community preview</p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      <div className="mb-4 flex items-start gap-4">
        <Avatar avatarUrl={user.avatarUrl} name={user.name} sizeClassName="w-16 h-16" textClassName="text-2xl" />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-lg font-bold text-gray-900 dark:text-gray-100">{user.name}</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">🏠 {user.homepark}</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{user.bio}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="surface-subtle p-3 text-center">
          <p className="text-2xl font-bold text-primary">{user.uniqueCoasters}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Unique Coasters</p>
        </div>
        <div className="surface-subtle p-3 text-center">
          <p className="truncate text-lg font-bold text-primary">{user.topCoaster}</p>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Current #1</p>
        </div>
      </div>

      <button
        onClick={() => {
          onClose();
          onOpenAuth();
        }}
        className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md"
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
      className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/10 dark:border-primary/25 dark:bg-primary/10"
    >
      Sign in to start
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="surface-subtle p-2 text-center">
      <p className="text-xs text-gray-400 dark:text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-center dark:border-gray-800 dark:bg-gray-950">
      <p className="text-lg font-bold text-primary">{value}</p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}
