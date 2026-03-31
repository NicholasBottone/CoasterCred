import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { useState } from "react";
import { FeedPage } from "./pages/FeedPage";
import { ExplorePage } from "./pages/ExplorePage";
import { RankingsPage } from "./pages/RankingsPage";
import { ProfilePage } from "./pages/ProfilePage";

type Tab = "feed" | "explore" | "rankings" | "profile";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white border-b shadow-sm px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎢</span>
          <span className="text-xl font-bold text-primary">CoasterCred</span>
        </div>
        <SignOutButton />
      </header>

      {/* Content */}
      <main className="flex-1 pb-20">
        {tab === "feed" && <FeedPage />}
        {tab === "explore" && <ExplorePage />}
        {tab === "rankings" && <RankingsPage />}
        {tab === "profile" && <ProfilePage />}
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t flex">
        {(
          [
            { id: "feed", label: "Feed", icon: "🏠" },
            { id: "explore", label: "Explore", icon: "🔍" },
            { id: "rankings", label: "Rankings", icon: "🏆" },
            { id: "profile", label: "Profile", icon: "👤" },
          ] as { id: Tab; label: string; icon: string }[]
        ).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex-1 flex flex-col items-center py-2 text-xs font-medium transition-colors ${
              tab === item.id
                ? "text-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-4 flex items-center gap-2">
        <span className="text-2xl">🎢</span>
        <span className="text-xl font-bold text-primary">CoasterCred</span>
      </header>
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">🎢</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">CoasterCred</h1>
          <p className="text-lg text-gray-600 mb-2">
            Track every coaster you've ridden. Rank them. Share with friends.
          </p>
          <p className="text-sm text-gray-400">
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
