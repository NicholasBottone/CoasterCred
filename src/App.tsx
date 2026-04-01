import { Authenticated, Unauthenticated } from "convex/react";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import { FeedPage } from "./pages/FeedPage";
import { RankingsPage } from "./pages/RankingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SearchPage } from "./pages/SearchPage";
import { MyListPage } from "./pages/MyListPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";

type Tab = "feed" | "myList" | "search" | "rankings" | "profile";
type ThemeMode = "auto" | "light" | "dark";
const THEME_STORAGE_KEY = "coastercred-theme";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <Authenticated>
        <AuthenticatedApp />
      </Authenticated>
      <Unauthenticated>
        <LandingPage />
      </Unauthenticated>
      <Toaster />
    </div>
  );
}

function AuthenticatedApp() {
  const [tab, setTab] = useState<Tab>("feed");
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);
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
      {/* Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-gray-200 bg-white/95 px-4 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎢</span>
          <span className="text-xl font-bold text-primary">CoasterCred</span>
        </div>
        <SignOutButton />
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
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
            {tab === "profile" && (
              <ProfilePage
                onViewPublicProfile={(userId) => setPublicProfileUserId(userId)}
                themeMode={themeMode}
                onThemeModeChange={setThemeMode}
              />
            )}
          </>
        )}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-gray-200 bg-white/95 backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        {(
          [
            { id: "feed", label: "Feed", icon: "🏠" },
            { id: "myList", label: "My List", icon: "📋" },
            { id: "search", label: "Search", icon: "🔍" },
            { id: "rankings", label: "Rankings", icon: "🏆" },
            { id: "profile", label: "Profile", icon: "👤" },
          ] as { id: Tab; label: string; icon: string }[]
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setPublicProfileUserId(null);
              setTab(item.id);
            }}
            className={`relative flex-1 px-1 py-1.5 text-xs font-medium transition-all ${
              publicProfileUserId === null && tab === item.id
                ? "bg-primary/5 text-primary dark:bg-primary/10 dark:text-indigo-300"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {publicProfileUserId === null && tab === item.id && (
              <span className="absolute inset-x-4 top-1 h-1 rounded-full bg-primary/80 dark:bg-indigo-300" />
            )}
            <span
              className={`mx-auto flex h-8 w-12 items-center justify-center rounded-full text-xl transition-all ${
                publicProfileUserId === null && tab === item.id
                  ? "bg-primary/15 shadow-sm ring-1 ring-primary/30 dark:bg-primary/25 dark:ring-primary/40"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {item.icon}
            </span>
            <span
              className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 ${
                publicProfileUserId === null && tab === item.id
                  ? "bg-primary/10 font-semibold dark:bg-primary/20"
                  : ""
              }`}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      <header className="px-6 py-4 flex items-center gap-2">
        <span className="text-2xl">🎢</span>
        <span className="text-xl font-bold text-primary">CoasterCred</span>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎢</div>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-3">CoasterCred</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
            Track every coaster you've ridden. Rank them. Share with friends.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            The social platform for roller coaster enthusiasts.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <SignInForm />
        </div>
      </main>
    </div>
  );
}
