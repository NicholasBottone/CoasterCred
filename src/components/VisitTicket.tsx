import type { ReactNode } from "react";
import { formatDate } from "../lib/dateUtils";

export function VisitTicket({
  date,
  header,
  people,
  children,
}: {
  date: string;
  header: ReactNode;
  people: ReactNode;
  children: ReactNode;
}) {
  const parsed = new Date(`${date}T12:00:00`);
  const valid = !Number.isNaN(parsed.getTime());
  return (
    <article className="visit-ticket">
      <header className="visit-ticket-header">
        <time
          className="visit-date"
          dateTime={valid ? date : undefined}
          aria-label={valid ? formatDate(date) : "Unknown date"}
        >
          <span className="visit-day">{valid ? parsed.getDate() : "—"}</span>
          <span>
            {valid
              ? parsed.toLocaleDateString("en-US", { month: "short" })
              : "Unknown"}
          </span>
          <span>{valid ? parsed.getFullYear() : "date"}</span>
        </time>
        <div className="visit-info">{header}</div>
        <div className="visit-people">{people}</div>
      </header>
      <div className="visit-rides">{children}</div>
    </article>
  );
}
