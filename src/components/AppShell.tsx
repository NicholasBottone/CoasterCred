import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  House,
  ListOrdered,
  Search,
  Trophy,
  UserRound,
  RollerCoaster,
  type LucideIcon,
} from "lucide-react";

import { TAB_PATHS, type Tab } from "../routes";

const GITHUB_REPO_URL = "https://github.com/NicholasBottone/CoasterCred";

const NAV_ITEMS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "feed", label: "Feed", icon: House },
  { id: "myList", label: "My List", icon: ListOrdered },
  { id: "search", label: "Search", icon: Search },
  { id: "rankings", label: "Rankings", icon: Trophy },
  { id: "profile", label: "Profile", icon: UserRound },
];

export function AppShell({
  tab,
  onSelectTab,
  children,
  headerAction,
  banner,
  bottomBanner,
  availableTabs,
}: {
  tab: Tab | null;
  onSelectTab?: (tab: Tab) => void;
  children: ReactNode;
  headerAction?: ReactNode;
  banner?: ReactNode;
  bottomBanner?: ReactNode;
  availableTabs?: Tab[];
}) {
  const visibleNavItems = NAV_ITEMS.filter(
    (item) => availableTabs?.includes(item.id) ?? true,
  );
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);
  const currentYear = new Date().getFullYear();

  return (
    <div
      className={`app-shell${bottomBanner ? " app-shell-with-bottom-banner" : ""}`}
    >
      <header className="app-chrome app-header">
        <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <RollerCoaster
              className="brand-mark"
              aria-hidden="true"
              strokeWidth={1.6}
            />
            <span className="brand-wordmark">CoasterCred</span>
          </div>
          {headerAction}
        </div>
        {banner}
      </header>

      <main ref={mainRef} className="app-main">
        {children}
        <div className="px-4 pb-3 pt-6 text-center text-[11px] text-gray-400 dark:text-gray-500">
          <div className="mx-auto flex max-w-lg flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <span>© {currentYear} Nicholas Bottone</span>
            <span aria-hidden="true">·</span>
            <span>Licensed under AGPL-3.0</span>
            <span aria-hidden="true">·</span>
            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-gray-600 dark:hover:text-gray-300"
            >
              View source on GitHub
            </a>
          </div>
        </div>
      </main>

      {bottomBanner && <div className="app-bottom-banner">{bottomBanner}</div>}

      <nav className="app-chrome app-nav" aria-label="Main navigation">
        {visibleNavItems.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            to={TAB_PATHS[id]}
            onClick={(event) => {
              if (
                event.button !== 0 ||
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              ) {
                return;
              }
              if (location.pathname === TAB_PATHS[id]) event.preventDefault();
              onSelectTab?.(id);
            }}
            data-onboarding-target={`nav-${id}`}
            aria-current={tab === id ? "page" : undefined}
          >
            <Icon
              aria-hidden="true"
              size={21}
              strokeWidth={tab === id ? 2 : 1.75}
            />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
