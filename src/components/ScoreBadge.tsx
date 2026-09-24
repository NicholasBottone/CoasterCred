import { cn } from "../lib/utils";

function getScoreTone(score: number, muted: boolean) {
  if (score >= 7) {
    return muted
      ? "border-green-400/50 bg-green-50/50 text-green-800/85 dark:border-green-500/25 dark:bg-green-500/5 dark:text-green-200/75"
      : "border-green-400 bg-green-50 text-green-700 dark:border-green-500/35 dark:bg-green-500/10 dark:text-green-200";
  }
  if (score >= 4) {
    return muted
      ? "border-amber-400/50 bg-amber-50/50 text-amber-800/85 dark:border-amber-500/25 dark:bg-amber-500/5 dark:text-amber-200/75"
      : "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200";
  }
  return muted
    ? "border-red-400/50 bg-red-50/50 text-red-700/85 dark:border-red-500/25 dark:bg-red-500/5 dark:text-red-200/75"
    : "border-red-400 bg-red-50 text-red-600 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-200";
}

export function ScoreBadge({
  score,
  size = "md",
  muted = false,
  className,
}: {
  score: number;
  size?: "sm" | "md";
  muted?: boolean;
  className?: string;
}) {
  const tone = getScoreTone(score, muted);
  const sizeClassName =
    size === "sm"
      ? "h-9 w-9 text-[13px]"
      : "h-10 w-10 text-sm";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 font-bold leading-none tabular-nums transition-transform",
        tone,
        sizeClassName,
        className,
      )}
      aria-label={`Score ${score.toFixed(1)} out of 10`}
      title={`${score.toFixed(1)} / 10`}
    >
      {score.toFixed(1)}
    </div>
  );
}
