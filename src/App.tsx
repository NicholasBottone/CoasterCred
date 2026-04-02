import { Authenticated, Unauthenticated, useConvexAuth, useQuery } from "convex/react";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
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
  const availableTabs: Tab[] = isAdmin
    ? ["feed", "myList", "search", "rankings", "profile", "admin"]
    : ["feed", "myList", "search", "rankings", "profile"];

  useEffect(() => {
    if (tab === "admin" && viewerShell !== undefined && !isAdmin) {
      setTab("feed");
    }
  }, [isAdmin, tab, viewerShell]);

  return (
    <AppShell
      tab={tab}
      onSelectTab={(nextTab) => {
        setPublicProfileUserId(null);
        setTab(nextTab);
      }}
      headerAction={<AuthenticatedHeaderActions viewerShell={viewerShell} />}
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
          {tab === "feed" && <FeedPage onViewPublicProfile={(userId) => setPublicProfileUserId(userId)} />}
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

function AuthenticatedHeaderActions({ viewerShell }: { viewerShell: any }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar
        avatarUrl={viewerShell?.profile?.avatarUrl ?? viewerShell?.user?.image}
        name={viewerShell?.user?.name}
        sizeClassName="w-9 h-9"
        textClassName="text-sm"
      />
      <SignOutButton />
    </div>
  );
}
