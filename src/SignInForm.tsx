"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        <button
          className="auth-button flex items-center justify-center gap-2"
          type="button"
          disabled={submitting}
          onClick={async () => {
            if (submitting) return;
            setSubmitting(true);
            try {
              await signIn("discord");
            } catch (error: any) {
              const message = String(error?.message ?? "");
              toast.error(
                message.includes("provider")
                  ? "Discord sign-in is not configured yet."
                  : "Could not start Discord sign-in.",
              );
              setSubmitting(false);
            }
          }}
        >
          <DiscordIcon className="h-4 w-4 shrink-0" />
          <span>{submitting ? "Redirecting to Discord..." : "Continue with Discord"}</span>
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
