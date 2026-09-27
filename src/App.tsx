import { RollerCoaster } from "lucide-react";
import {
  Authenticated,
  Unauthenticated,
  useConvexAuth,
  useMutation,
  useQuery,
} from "convex/react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { Toaster } from "sonner";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SignOutButton } from "./SignOutButton";
import { api } from "../convex/_generated/api";
import { FeedPage } from "./pages/FeedPage";
import { RankingsPage } from "./pages/RankingsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SearchPage } from "./pages/SearchPage";
import { MyListPage } from "./pages/MyListPage";
import { PublicProfilePage } from "./pages/PublicProfilePage";
import { AdminPage } from "./pages/AdminPage";
import { AppShell } from "./components/AppShell";
import { NotFoundPage } from "./components/NotFoundPage";
import { Avatar } from "./components/Avatar";
import {
  OnboardingTour,
  type OnboardingStep,
} from "./components/OnboardingTour";
import { DemoApp } from "./demo/DemoApp";
import { riderPath, tabFromPath, TAB_PATHS, type Tab } from "./routes";

type ThemeMode = "auto" | "light" | "dark";
type SearchMode = "coasters" | "members";

const THEME_STORAGE_KEY = "coastercred-theme";
const ONBOARDING_VERSION = 1;

function focusSearchInput() {
  const input = document.querySelector<HTMLInputElement>(
    '[data-search-autofocus="true"]',
  );
  input?.focus();
  input?.select();
}

export default function App() {
  const { isLoading } = useConvexAuth();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "auto";
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" || stored === "auto"
      ? stored
      : "auto";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark =
        themeMode === "dark" || (themeMode === "auto" && media.matches);
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
        <AuthenticatedApp
          themeMode={themeMode}
          onThemeModeChange={setThemeMode}
        />
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
        <RollerCoaster className="h-8 w-8" aria-hidden="true" />
        <span className="text-2xl font-bold">CoasterCred</span>
      </div>
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Signing you in...
      </p>
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
  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as {
    fromApp?: boolean;
    fromTab?: Tab;
  } | null;
  const tab =
    tabFromPath(location.pathname) ??
    (location.pathname.startsWith("/riders/")
      ? (routeState?.fromTab ?? null)
      : null);
  const [guidedSearchMode, setGuidedSearchMode] = useState<SearchMode | null>(
    null,
  );
  const [tourOpen, setTourOpen] = useState(false);
  const [hasAutoOpenedTour, setHasAutoOpenedTour] = useState(false);
  const viewerShell = useQuery(api.profiles.getViewerShell);
  const markOnboardingSeen = useMutation(api.profiles.markOnboardingSeen);
  const isAdmin = viewerShell?.isAdmin ?? false;
  const availableTabs: Tab[] = [
    "feed",
    "myList",
    "search",
    "rankings",
    "profile",
  ];

  const handleSelectTab = (nextTab: Tab) => {
    setGuidedSearchMode(null);
    if (nextTab === "search" && location.pathname === TAB_PATHS.search) {
      focusSearchInput();
    }
  };

  const openPublicProfile = (userId: string) => {
    const path = riderPath(userId);
    if (location.pathname !== path) {
      navigate(path, { state: { fromApp: true, fromTab: tab } });
    }
  };

  const backFromPublicProfile = () => {
    if (routeState?.fromApp) {
      navigate(-1);
    } else {
      navigate(TAB_PATHS.feed, { replace: true });
    }
  };

  useEffect(() => {
    if (
      hasAutoOpenedTour ||
      viewerShell === undefined ||
      viewerShell === null ||
      location.pathname !== TAB_PATHS.feed
    ) {
      return;
    }

    if ((viewerShell.onboarding?.versionSeen ?? 0) < ONBOARDING_VERSION) {
      setHasAutoOpenedTour(true);
      setTourOpen(true);
    }
  }, [hasAutoOpenedTour, location.pathname, viewerShell]);

  const markTourSeen = useCallback(async () => {
    try {
      await markOnboardingSeen({ version: ONBOARDING_VERSION });
    } catch (error) {
      console.error("Could not mark onboarding as seen", error);
    }
  }, [markOnboardingSeen]);

  const closeTour = useCallback(() => {
    setTourOpen(false);
    setGuidedSearchMode(null);
    void markTourSeen();
  }, [markTourSeen]);

  const onboardingSteps = useMemo<OnboardingStep[]>(
    () => [
      {
        id: "welcome",
        title: "Welcome to CoasterCred",
        body: "This quick tour shows the fastest path to logging rides, building rankings, and finding friends.",
        onEnter: () => {
          setGuidedSearchMode(null);
          navigate(TAB_PATHS.feed, { replace: true });
        },
      },
      {
        id: "search-tab",
        title: "Start in Search",
        body: "Search is where you find coasters to log and members to follow.",
        targetSelector: '[data-onboarding-target="nav-search"]',
        placement: "top",
        onEnter: () => {
          setGuidedSearchMode("coasters");
          navigate(TAB_PATHS.search, { replace: true });
        },
      },
      {
        id: "coaster-search",
        title: "Log coasters here",
        body: "Search for a coaster, open a result, then tap Log to record the ride and place it in your rankings.",
        targetSelector: '[data-onboarding-target="coaster-search-input"]',
        onEnter: () => {
          setGuidedSearchMode("coasters");
          navigate(TAB_PATHS.search, { replace: true });
        },
      },
      {
        id: "member-search",
        title: "Add friends here",
        body: "Switch to Members, search by name or handle, then follow people to see their ride activity and coaster overlap.",
        targetSelector: '[data-onboarding-target="member-search-input"]',
        onEnter: () => {
          setGuidedSearchMode("members");
          navigate(TAB_PATHS.search, { replace: true });
        },
      },
      {
        id: "my-list",
        title: "Your rankings live in My List",
        body: "CoasterCred builds your list from logged rides. You can make quick ranking tweaks or import a CSV here.",
        targetSelector: '[data-onboarding-target="nav-myList"]',
        placement: "top",
        onEnter: () => {
          setGuidedSearchMode(null);
          navigate(TAB_PATHS.myList, { replace: true });
        },
      },
    ],
    [navigate],
  );

  return (
    <>
      <AppShell
        tab={tab}
        onSelectTab={handleSelectTab}
        headerAction={
          <AuthenticatedHeaderActions
            isAdmin={isAdmin}
            viewerShell={viewerShell}
            onOpenAdmin={() => {
              setGuidedSearchMode(null);
              navigate(TAB_PATHS.admin);
            }}
            onStartTutorial={() => {
              setTourOpen(true);
            }}
          />
        }
        availableTabs={availableTabs}
      >
        <Routes>
          <Route
            path="/"
            element={
              <FeedPage
                onViewPublicProfile={openPublicProfile}
                onOpenSearch={() => navigate(TAB_PATHS.search)}
              />
            }
          />
          <Route path="/my-list" element={<MyListPage />} />
          <Route
            path="/search"
            element={<SearchPage guidedMode={guidedSearchMode} />}
          />
          <Route
            path="/rankings"
            element={<RankingsPage onViewPublicProfile={openPublicProfile} />}
          />
          <Route
            path="/profile"
            element={
              <ProfilePage
                onViewPublicProfile={openPublicProfile}
                onOpenMyList={() => navigate(TAB_PATHS.myList)}
                themeMode={themeMode}
                onThemeModeChange={onThemeModeChange}
              />
            }
          />
          <Route
            path="/riders/:userId"
            element={
              <PublicRiderRoute
                onBack={backFromPublicProfile}
                onViewProfile={openPublicProfile}
              />
            }
          />
          <Route
            path="/admin"
            element={
              viewerShell === undefined ? (
                <AuthLoadingScreen />
              ) : isAdmin ? (
                <AdminPage onViewPublicProfile={openPublicProfile} />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
      <OnboardingTour
        open={tourOpen}
        steps={onboardingSteps}
        onClose={closeTour}
      />
    </>
  );
}

function PublicRiderRoute({
  onBack,
  onViewProfile,
}: {
  onBack: () => void;
  onViewProfile: (userId: string) => void;
}) {
  const { userId } = useParams();
  if (!userId) return <NotFoundPage />;
  return (
    <PublicProfilePage
      key={userId}
      userId={userId}
      onBack={onBack}
      onViewProfile={onViewProfile}
    />
  );
}

function AuthenticatedHeaderActions({
  isAdmin,
  viewerShell,
  onOpenAdmin,
  onStartTutorial,
}: {
  isAdmin: boolean;
  viewerShell: any;
  onOpenAdmin: () => void;
  onStartTutorial: () => void;
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
          avatarUrl={
            viewerShell?.profile?.avatarUrl ?? viewerShell?.user?.image
          }
          name={viewerShell?.user?.name}
          sizeClassName="h-8 w-8 sm:h-9 sm:w-9"
          textClassName="text-sm"
        />
      </button>

      <div
        className={`absolute right-0 top-full z-30 mt-2 w-40 origin-top-right rounded-md border border-gray-200 bg-white p-1.5 shadow-lg transition-all dark:border-gray-700 dark:bg-gray-900 ${
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
        <button
          type="button"
          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-50"
          onClick={() => {
            setMenuOpen(false);
            onStartTutorial();
          }}
          role="menuitem"
        >
          Tutorial
        </button>
        <SignOutButton
          className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-gray-50"
          onClick={() => setMenuOpen(false)}
          role="menuitem"
        />
      </div>
    </div>
  );
}
