"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="rounded-lg border border-gray-200 bg-white px-4 py-2 font-semibold text-secondary shadow-sm transition-all hover:-translate-y-0.5 hover:bg-gray-50 hover:text-secondary-hover hover:shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
      onClick={() => void signOut()}
    >
      Sign out
    </button>
  );
}
