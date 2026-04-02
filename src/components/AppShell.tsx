import type { ReactNode } from "react";

export type Tab = "feed" | "myList" | "search" | "rankings" | "profile" | "admin";

const NAV_ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: "feed", label: "Feed", icon: "🏠" },
  { id: "myList", label: "My List", icon: "📋" },
  { id: "search", label: "Search", icon: "🔍" },
  { id: "rankings", label: "Rankings", icon: "🏆" },
  { id: "profile", label: "Profile", icon: "👤" },
];

export function AppShell({
  tab,
  onSelectTab,
  children,
  headerAction,
  banner,
  availableTabs,
}: {
  tab: Tab;
  onSelectTab: (tab: Tab) => void;
  children: ReactNode;
  headerAction?: ReactNode;
  banner?: ReactNode;
  availableTabs?: Tab[];
}) {
  const visibleNavItems = NAV_ITEMS.filter((item) => availableTabs?.includes(item.id) ?? true);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        <div className="flex h-14 items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xl sm:text-2xl">🎢</span>
            <span className="truncate text-lg font-bold text-primary sm:text-xl">CoasterCred</span>
          </div>
          {headerAction}
        </div>
        {banner}
      </header>

      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom,0px)+0.75rem)]">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t border-gray-200 bg-white/95 pb-[calc(env(safe-area-inset-bottom,0px)+0.375rem)] backdrop-blur dark:border-gray-800 dark:bg-gray-900/95">
        {visibleNavItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`relative flex-1 px-1 py-1.5 text-xs font-medium transition-all ${
              tab === item.id
                ? "bg-primary/5 text-primary dark:bg-primary/10 dark:text-indigo-300"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {tab === item.id && (
              <span className="absolute inset-x-4 top-1 h-1 rounded-full bg-primary/80 dark:bg-indigo-300" />
            )}
            <span
              className={`mx-auto flex h-8 w-12 items-center justify-center rounded-full text-xl transition-all ${
                tab === item.id
                  ? "bg-primary/15 shadow-sm ring-1 ring-primary/30 dark:bg-primary/25 dark:ring-primary/40"
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              }`}
            >
              {item.icon}
            </span>
            <span
              className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 ${
                tab === item.id ? "bg-primary/10 font-semibold dark:bg-primary/20" : ""
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
