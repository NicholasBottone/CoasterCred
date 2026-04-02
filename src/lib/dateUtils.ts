export function formatDistanceToNow(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export function todayDateInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dateInputValueToTimestamp(dateValue: string): number {
  return new Date(`${dateValue}T12:00:00`).getTime();
}

export function formatDate(dateValue?: string | null): string {
  if (!dateValue) return "Unknown date";
  const parsed = new Date(`${dateValue}T12:00:00`);
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(timestamp?: number | null): string {
  if (!timestamp) return "Never";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
