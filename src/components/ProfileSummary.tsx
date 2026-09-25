import { ScoreBadge } from "./ScoreBadge";

export function ProfileSummary({
  count,
  topName,
  topScore,
  onOpen,
}: {
  count: number;
  topName?: string | null;
  topScore?: number | null;
  onOpen?: () => void;
}) {
  const Tag = onOpen ? "button" : "div";
  return (
    <div className="profile-summary">
      <Tag
        className="profile-count"
        {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      >
        <strong>{count.toLocaleString()}</strong>
        <span>Unique coasters</span>
      </Tag>
      <Tag
        className="profile-favorite"
        {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      >
        <div>
          <span>Current #1</span>
          <strong>{topName ?? "—"}</strong>
        </div>
        {typeof topScore === "number" && (
          <ScoreBadge score={topScore} size="sm" />
        )}
      </Tag>
    </div>
  );
}
