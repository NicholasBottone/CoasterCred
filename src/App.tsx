import { Authenticated, Unauthenticated, useConvexAuth, useQuery } from "convex/react";
import { flushSync } from "react-dom";
import { Toaster } from "sonner";
import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "./SignOutButton";
import { api } from "../convex/_generated/api";
import { FeedPage } from "./pages/FeedPage";
import { RankingsPage } from "./pages/RankingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SearchPage } from "./pages/SearchPage";
import { MyListPage } from "./pages/MyListPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { AppShell, type Tab } from "./components/AppShell";
import { Avatar } from "./components/Avatar";
import { DemoApp } from "./demo/DemoApp";

type ThemeMode = "auto" | "light" | "dark";

const THEME_STORAGE_KEY = "coastercred-theme";

function focusSearchInput() {
  const input = document.querySelector<HTMLInputElement>('[data-search-autofocus="true"]');
  input?.focus();
  input?.select();
}

export default function App() {
  const { isLoading } = useConvexAuth();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "auto";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "auto" ? stored : "auto";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark = themeMode === "dark" || (themeMode === "auto" && media.matches);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    };

    applyTheme();
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    if (themeMode === "auto") {
      media.addEventListener("change", applyTheme);
      return () => media.removeEventListener("change", applyTheme);
    }
  }, [themeMode]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {isLoading && <AuthLoadingScreen />}
      <Authenticated>
        <AuthenticatedApp themeMode={themeMode} onThemeModeChange={setThemeMode} />
      </Authenticated>
      <Unauthenticated>
        <DemoApp />
      </Unauthenticated>
      <Toaster />
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex items-center gap-3 text-primary">
        <span className="text-3xl">🎢</span>
        <span className="text-2xl font-bold">CoasterCred</span>
      </div>
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Signing you in...</p>
    </div>
  );
}

function AuthenticatedApp({
  themeMode,
  onThemeModeChange,
}: {
  themeMode: ThemeMode;
  onThemeModeChange: (themeMode: ThemeMode) => void;
}) {
  const [tab, setTab] = useState<Tab>("feed");
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);
  const viewerShell = useQuery(api.profiles.getViewerShell);
  const isAdmin = viewerShell?.isAdmin ?? false;
  const availableTabs: Tab[] = ["feed", "myList", "search", "rankings", "profile"];

  useEffect(() => {
    if (tab === "admin" && viewerShell !== undefined && !isAdmin) {
      setTab("feed");
    }
  }, [isAdmin, tab, viewerShell]);

  const handleSelectTab = (nextTab: Tab) => {
    if (nextTab === "search") {
      flushSync(() => {
        setPublicProfileUserId(null);
        setTab("search");
      });
      focusSearchInput();
      return;
    }

    setPublicProfileUserId(null);
    setTab(nextTab);
  };

  return (
    <AppShell
      tab={tab}
      onSelectTab={handleSelectTab}
      headerAction={
        <AuthenticatedHeaderActions
          isAdmin={isAdmin}
          viewerShell={viewerShell}
          onOpenAdmin={() => {
            setPublicProfileUserId(null);
            setTab("admin");
          }}
        />
      }
      availableTabs={availableTabs}
    >
      {publicProfileUserId ? (
        <PublicProfilePage
          userId={publicProfileUserId}
          onBack={() => setPublicProfileUserId(null)}
          onViewProfile={(userId) => setPublicProfileUserId(userId)}
        />
      ) : (
        <>
          {tab === "feed" && (
            <FeedPage
              onViewPublicProfile={(userId) => setPublicProfileUserId(userId)}
              onOpenSearch={() => handleSelectTab("search")}
            />
          )}
          {tab === "myList" && <MyListPage />}
          {tab === "search" && <SearchPage />}
          {tab === "rankings" && <RankingsPage onViewPublicProfile={(userId) => setPublicProfileUserId(userId)} />}
          {tab === "admin" && <AdminPage onViewPublicProfile={(userId) => setPublicProfileUserId(userId)} />}
          {tab === "profile" && (
            <ProfilePage
              onViewPublicProfile={(userId) => setPublicProfileUserId(userId)}
              themeMode={themeMode}
              onThemeModeChange={onThemeModeChange}
              viewerShell={viewerShell ?? null}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function AuthenticatedHeaderActions({
  isAdmin,
  viewerShell,
  onOpenAdmin,
}: {
  isAdmin: boolean;
  viewerShell: any;
  onOpenAdmin: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <div
      ref={menuRef}
      className="relative flex shrink-0 items-center"
      onMouseEnter={() => setMenuOpen(true)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Open profile menu"
        className={`rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          menuOpen ? "ring-2 ring-primary/20" : ""
        }`}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <Avatar
          avatarUrl={viewerShell?.profile?.avatarUrl ?? viewerShell?.user?.image}
          name={viewerShell?.user?.name}
          sizeClassName="h-8 w-8 sm:h-9 sm:w-9"
          textClassName="text-sm"
        />
      </button>

      <div
        className={`absolute right-0 top-full z-30 mt-2 w-40 origin-top-right rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg transition-all dark:border-gray-700 dark:bg-gray-900 ${
          menuOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0"
        }`}
        role="menu"
        aria-label="Profile menu"
      >
        {isAdmin && (
          <button
            type="button"
            className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-50"
            onClick={() => {
              setMenuOpen(false);
              onOpenAdmin();
            }}
            role="menuitem"
          >
            Admin
          </button>
        )}
        <SignOutButton
          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-50"
          onClick={() => setMenuOpen(false)}
          role="menuitem"
        />
      </div>
    </div>
  );
}
