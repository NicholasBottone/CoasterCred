"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [submittingProvider, setSubmittingProvider] = useState<"discord" | "google" | null>(null);

  const handleProviderSignIn = async (provider: "discord" | "google") => {
    if (submittingProvider) return;
    setSubmittingProvider(provider);
    try {
      const redirectTo =
        typeof window === "undefined"
          ? "/"
          : `${window.location.pathname}${window.location.search}${window.location.hash}`;
      await signIn(provider, { redirectTo });
    } catch (error: any) {
      const message = String(error?.message ?? "");
      const providerLabel = provider === "discord" ? "Discord" : "Google";
      toast.error(
        message.includes("provider")
          ? `${providerLabel} sign-in is not configured yet.`
          : `Could not start ${providerLabel} sign-in.`,
      );
      setSubmittingProvider(null);
    }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        <button
          className="auth-button flex items-center justify-center gap-2"
          type="button"
          disabled={submittingProvider !== null}
          onClick={() => void handleProviderSignIn("discord")}
        >
          <DiscordIcon className="h-4 w-4 shrink-0" />
          <span>
            {submittingProvider === "discord"
              ? "Redirecting to Discord..."
              : "Continue with Discord"}
          </span>
        </button>
        <button
          className="auth-button flex items-center justify-center gap-2"
          type="button"
          disabled={submittingProvider !== null}
          onClick={() => void handleProviderSignIn("google")}
        >
          <GoogleIcon className="h-4 w-4 shrink-0" />
          <span>
            {submittingProvider === "google"
              ? "Redirecting to Google..."
              : "Continue with Google"}
          </span>
        </button>
      </div>
    </div>
  );
}

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 127.14 96.36"
      className={className}
      fill="currentColor"
    >
      <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47.14a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64.14 105.89 105.89 0 0 0 19.39 8.07C2.79 32.65-1.71 56.62.54 80.24A105.73 105.73 0 0 0 32.71 96a77.7 77.7 0 0 0 6.89-11.28 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.04a75.57 75.57 0 0 0 64.32 0c.87.7 1.76 1.38 2.66 2.04a68.68 68.68 0 0 1-10.87 5.19A77 77 0 0 0 94.41 96a105.25 105.25 0 0 0 32.19-15.76c2.64-27.38-4.51-51.14-18.9-72.17ZM42.45 65.69C36.18 65.69 31 59.98 31 52.95s5.06-12.74 11.43-12.74S54 45.92 53.91 52.95c0 7.03-5.06 12.74-11.46 12.74Zm42.24 0c-6.27 0-11.43-5.71-11.43-12.74s5.06-12.74 11.43-12.74S96.15 45.92 96.15 52.95c0 7.03-5.06 12.74-11.46 12.74Z" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M21.35 11.1H12v2.98h5.38c-.48 3.04-3.08 4.34-5.37 4.34a6.42 6.42 0 0 1 0-12.84 5.9 5.9 0 0 1 4.16 1.64l2.12-2.16A8.93 8.93 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19 8.62 8.62 0 0 0 8.98-8.98 7.4 7.4 0 0 0-.13-1.42Z" />
    </svg>
  );
}
