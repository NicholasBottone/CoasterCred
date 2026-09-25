import { useId, useMemo, useState } from "react";
import { ArrowUp, Gauge, Ruler, Timer, Orbit, History } from "lucide-react";
import { type CoasterSummary } from "../lib/coasterData";

type WrappedMetricKey =
  | "heightFt"
  | "speedMph"
  | "lengthFt"
  | "durationSeconds"
  | "inversions"
  | "ageYears";

type WrappedMetric = {
  key: WrappedMetricKey;
  coaster: CoasterSummary | null;
  value: number | null;
  total: number | null;
  average: number | null;
  count: number;
};

type WrappedPeriodStats = {
  key: string;
  label: string;
  year: number | null;
  uniqueCoasterCount: number;
  parkCount: number;
  countryCount: number;
  topManufacturer: {
    name: string;
    count: number;
  } | null;
  metrics: Record<WrappedMetricKey, WrappedMetric>;
};

type WrappedStats = {
  allTime: WrappedPeriodStats;
  yearly: WrappedPeriodStats[];
};

type MetricDefinition = {
  key: WrappedMetricKey;
  title: string;
  valueLabel: string;
  averageLabel: string;
  totalLabel?: string;
  formatValue: (value: number, coaster?: CoasterSummary | null) => string;
  formatAverage: (value: number) => string;
  formatTotal?: (value: number) => string;
};

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});

function formatFeet(value: number) {
  return `${numberFormatter.format(value)} ft`;
}

function formatMph(value: number) {
  return `${decimalFormatter.format(value)} mph`;
}

function formatCount(value: number) {
  return numberFormatter.format(value);
}

function formatYears(value: number) {
  return `${numberFormatter.format(value)} yr`;
}

function formatDuration(value: number) {
  if (value < 60) {
    return `${numberFormatter.format(value)} sec`;
  }

  const rounded = Math.round(value);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  if (minutes < 60) {
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

const METRICS: MetricDefinition[] = [
  {
    key: "heightFt",
    title: "Tallest coaster",
    valueLabel: "Max",
    averageLabel: "Avg height",
    totalLabel: "Total height",
    formatValue: formatFeet,
    formatAverage: formatFeet,
    formatTotal: formatFeet,
  },
  {
    key: "speedMph",
    title: "Fastest coaster",
    valueLabel: "Max",
    averageLabel: "Avg speed",
    formatValue: formatMph,
    formatAverage: formatMph,
  },
  {
    key: "lengthFt",
    title: "Longest track",
    valueLabel: "Max",
    averageLabel: "Avg length",
    totalLabel: "Total length",
    formatValue: formatFeet,
    formatAverage: formatFeet,
    formatTotal: formatFeet,
  },
  {
    key: "durationSeconds",
    title: "Longest ride",
    valueLabel: "Max",
    averageLabel: "Avg duration",
    totalLabel: "Total duration",
    formatValue: formatDuration,
    formatAverage: formatDuration,
    formatTotal: formatDuration,
  },
  {
    key: "inversions",
    title: "Most inversions",
    valueLabel: "Max",
    averageLabel: "Avg inversions",
    totalLabel: "Total inversions",
    formatValue: formatCount,
    formatAverage: decimalFormatter.format,
    formatTotal: formatCount,
  },
  {
    key: "ageYears",
    title: "Oldest ride",
    valueLabel: "Opened",
    averageLabel: "Avg age",
    formatValue: (value, coaster) =>
      typeof coaster?.yearOpened === "number"
        ? String(coaster.yearOpened)
        : formatYears(value),
    formatAverage: formatYears,
  },
];

export function ProfileWrappedStats({
  stats,
  onSelectCoaster,
}: {
  stats?: WrappedStats | null;
  onSelectCoaster?: (coaster: CoasterSummary) => void;
}) {
  const periods = useMemo(
    () => (stats ? [stats.allTime, ...stats.yearly] : []),
    [stats],
  );
  const periodId = useId();
  const [selectedKey, setSelectedKey] = useState("all");
  const selectedPeriod =
    periods.find((period) => period.key === selectedKey) ?? periods[0] ?? null;

  if (!stats || !selectedPeriod || stats.allTime.uniqueCoasterCount === 0) {
    return null;
  }

  return (
    <section className="ride-stats" aria-label="Ride statistics">
      <div className="stats-heading">
        <div>
          <h2 className="technical-label">Ride Stats</h2>
          <p aria-live="polite">
            {selectedPeriod.uniqueCoasterCount} coaster
            {selectedPeriod.uniqueCoasterCount === 1 ? "" : "s"}
          </p>
        </div>
        <label className="sr-only" htmlFor={periodId}>
          Ride stats time range
        </label>
        <select
          id={periodId}
          value={selectedPeriod.key}
          onChange={(event) => setSelectedKey(event.target.value)}
        >
          {periods.map((period) => (
            <option key={period.key} value={period.key}>
              {period.label}
            </option>
          ))}
        </select>
      </div>
      <dl className="stats-overview">
        <div>
          <dt>Parks</dt>
          <dd>{numberFormatter.format(selectedPeriod.parkCount)}</dd>
        </div>
        <div>
          <dt>Countries</dt>
          <dd>{numberFormatter.format(selectedPeriod.countryCount)}</dd>
        </div>
        <div className="stats-maker">
          <dt>Most repeated maker</dt>
          <dd>
            {selectedPeriod.topManufacturer?.name ?? "Unknown"}
            <span>
              {selectedPeriod.topManufacturer
                ? `${selectedPeriod.topManufacturer.count} coaster${selectedPeriod.topManufacturer.count === 1 ? "" : "s"}`
                : "No maker data"}
            </span>
          </dd>
        </div>
      </dl>
      {METRICS.map((definition) => (
        <MetricRow
          key={definition.key}
          definition={definition}
          metric={selectedPeriod.metrics[definition.key]}
          onSelectCoaster={onSelectCoaster}
        />
      ))}
    </section>
  );
}

const METRIC_ICONS = {
  heightFt: ArrowUp,
  speedMph: Gauge,
  lengthFt: Ruler,
  durationSeconds: Timer,
  inversions: Orbit,
  ageYears: History,
};

function MetricRow({
  definition,
  metric,
  onSelectCoaster,
}: {
  definition: MetricDefinition;
  metric: WrappedMetric;
  onSelectCoaster?: (coaster: CoasterSummary) => void;
}) {
  const Icon = METRIC_ICONS[definition.key];
  const formatted =
    metric.value === null
      ? "—"
      : definition.formatValue(metric.value, metric.coaster);
  // Every row reserves the same unit column, including rows without a unit.
  const match = formatted.match(/^(.*) (ft|mph|sec|yr)$/);
  const value = match ? match[1] : formatted;
  const unit = match?.[2] ?? "";
  const content = (
    <>
      <span className="technical-label record-label">
        <Icon aria-hidden="true" />
        {definition.title}
      </span>
      <span
        className="record-value"
        aria-label={`${definition.valueLabel} ${formatted}`}
      >
        <span>{value}</span>
        <span className="record-unit">{unit}</span>
      </span>
      <span className="record-coaster">
        {metric.coaster?.name ?? "Unknown"}
      </span>
      <span className="record-park">
        {metric.coaster?.park ?? "No coaster data"}
      </span>
    </>
  );
  return (
    <div className="record-row">
      {metric.coaster && onSelectCoaster ? (
        <button
          type="button"
          className="record-main"
          onClick={() => onSelectCoaster(metric.coaster!)}
        >
          {content}
        </button>
      ) : (
        <div className="record-main">{content}</div>
      )}
      <div className="record-meta">
        <span>
          {definition.averageLabel}{" "}
          <strong>
            {metric.average === null
              ? "—"
              : definition.formatAverage(metric.average)}
          </strong>
        </span>
        {definition.totalLabel && definition.formatTotal && (
          <span>
            {definition.totalLabel}{" "}
            <strong>
              {metric.total === null
                ? "—"
                : definition.formatTotal(metric.total)}
            </strong>
          </span>
        )}
      </div>
    </div>
  );
}
