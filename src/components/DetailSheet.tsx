import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { CoasterSummary } from "../lib/coasterData";
import { getCoasterMaterialClasses } from "../lib/badges";
import { ScoreBadge } from "./ScoreBadge";
import { ModalCloseButton } from "./ModalContainer";

export function CoasterDetailHeader({
  title,
  metadata,
  location,
  logAction,
  onClose,
}: {
  title: string;
  metadata: ReactNode;
  location: string;
  logAction?: ReactNode;
  onClose: () => void;
}) {
  return (
    <header className="coaster-detail-header">
      <div className="coaster-header-top">
        <div className="coaster-identity">
          <h3 className="detail-title">{title}</h3>
          <div className="coaster-identity-meta">{metadata}</div>
        </div>
        <div className="coaster-header-actions">
          {logAction}
          <ModalCloseButton onClose={onClose} />
        </div>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{location}</p>
    </header>
  );
}

const number = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
export const formatMeasurement = (value: number, unit: string) =>
  `${number.format(value)} ${unit}`;

function formatRideDuration(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      <h4 className="detail-section-title">{title}</h4>
      {children}
    </section>
  );
}

export function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="detail-metric">
      <dt>{label}</dt>
      <dd>{typeof value === "number" ? number.format(value) : value}</dd>
    </div>
  );
}

export function CoasterSpecifications({
  coaster,
}: {
  coaster: CoasterSummary;
}) {
  const fields = [
    [
      "Height",
      coaster.heightFt == null
        ? null
        : formatMeasurement(coaster.heightFt, "ft"),
    ],
    [
      "Speed",
      coaster.speedMph == null
        ? null
        : formatMeasurement(coaster.speedMph, "mph"),
    ],
    ["Inversions", coaster.inversions],
    [
      "Length",
      coaster.lengthFt == null
        ? null
        : formatMeasurement(coaster.lengthFt, "ft"),
    ],
    ["Opened", coaster.yearOpened == null ? null : String(coaster.yearOpened)],
    ["Maker", coaster.manufacturer],
    ["Product", coaster.product],
    ["Propulsion", coaster.propulsion],
    [
      "Duration",
      coaster.durationSeconds == null
        ? null
        : formatRideDuration(coaster.durationSeconds),
    ],
  ].filter(
    (field) => field[1] !== undefined && field[1] !== null && field[1] !== "",
  );
  if (!fields.length) return null;
  return (
    <dl className="detail-specs" aria-label="Coaster specifications">
      {fields.map(([label, value]) => (
        <div key={label}>
          <dt className="technical-label">{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ParkCoasterRow({
  name,
  material,
  score,
  rideCount,
  rank,
  onClick,
}: {
  name: string;
  material: string;
  score?: number | null;
  rideCount?: number;
  rank?: number | null;
  onClick: () => void;
}) {
  return (
    <button type="button" className="park-coaster-row" onClick={onClick}>
      <span className="directory-name">
        <strong>{name}</strong>
        <span className="directory-meta">
          <span className={getCoasterMaterialClasses(material)}>
            {material}
          </span>
          {typeof rank === "number" && <span>Rank #{rank}</span>}
          {typeof rideCount === "number" && (
            <span>
              {rideCount > 0
                ? `${rideCount} ${rideCount === 1 ? "ride" : "rides"}`
                : "Not ridden"}
            </span>
          )}
        </span>
      </span>
      <span className="directory-rating">
        {typeof score === "number" && <ScoreBadge score={score} size="sm" />}
      </span>
      <ChevronRight
        className="directory-chevron"
        size={16}
        aria-hidden="true"
      />
    </button>
  );
}
