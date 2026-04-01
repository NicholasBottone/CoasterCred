import { cn } from "../lib/utils";

function getScoreTone(score: number) {
  if (score >= 7) {
    return "border-green-500 text-green-600";
  }
  if (score >= 4) {
    return "border-amber-500 text-amber-600";
  }
  return "border-red-500 text-red-500";
}

export function ScoreBadge({
  score,
  size = "md",
  className,
}: {
  score: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const tone = getScoreTone(score);
  const sizeClassName =
    size === "sm"
      ? "h-9 w-9 text-[13px]"
      : "h-10 w-10 text-sm";

  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-white font-bold leading-none tabular-nums",
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
