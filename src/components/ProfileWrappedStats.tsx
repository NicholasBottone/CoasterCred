import { useMemo, useState } from "react";
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
      typeof coaster?.yearOpened === "number" ? String(coaster.yearOpened) : formatYears(value),
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
  const [selectedKey, setSelectedKey] = useState("all");
  const selectedPeriod = periods.find((period) => period.key === selectedKey) ?? periods[0] ?? null;

  if (!stats || !selectedPeriod || stats.allTime.uniqueCoasterCount === 0) {
    return null;
  }

  return (
    <section className="surface-card p-4 mb-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-100">Ride Stats</h3>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {selectedPeriod.uniqueCoasterCount} coaster{selectedPeriod.uniqueCoasterCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <SummaryPill label="Parks" value={selectedPeriod.parkCount} />
          <SummaryPill label="Countries" value={selectedPeriod.countryCount} />
        </div>
      </div>

      {periods.length > 1 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {periods.map((period) => (
            <button
              key={period.key}
              type="button"
              onClick={() => setSelectedKey(period.key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                selectedPeriod.key === period.key
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="surface-subtle p-3">
          <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">
            Most repeated maker
          </p>
          <p className="mt-1 truncate text-base font-bold text-gray-900 dark:text-gray-100">
            {selectedPeriod.topManufacturer?.name ?? "Unknown"}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {selectedPeriod.topManufacturer
              ? `${selectedPeriod.topManufacturer.count} coaster${
                  selectedPeriod.topManufacturer.count === 1 ? "" : "s"
                }`
              : "No maker data"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SummaryTile label="Parks" value={selectedPeriod.parkCount} />
          <SummaryTile label="Countries" value={selectedPeriod.countryCount} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {METRICS.map((definition) => (
          <MetricTile
            key={definition.key}
            definition={definition}
            metric={selectedPeriod.metrics[definition.key]}
            onSelectCoaster={onSelectCoaster}
          />
        ))}
      </div>
    </section>
  );
}

function SummaryPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-primary/10 px-2.5 py-1 text-center">
      <p className="text-sm font-bold leading-none text-primary">{numberFormatter.format(value)}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase text-primary/70">{label}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-subtle flex min-h-24 flex-col items-center justify-center p-3 text-center">
      <p className="text-xl font-bold text-primary">{numberFormatter.format(value)}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </div>
  );
}

function MetricTile({
  definition,
  metric,
  onSelectCoaster,
}: {
  definition: MetricDefinition;
  metric: WrappedMetric;
  onSelectCoaster?: (coaster: CoasterSummary) => void;
}) {
  const content = (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase text-gray-400 dark:text-gray-500">
          {definition.title}
        </p>
        <p className="mt-1 truncate text-base font-bold text-gray-900 dark:text-gray-100">
          {metric.coaster?.name ?? "Unknown"}
        </p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
          {metric.coaster?.park ?? "No coaster data"}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500">
          {definition.valueLabel}
        </p>
        <p className="text-lg font-bold text-primary">
          {metric.value === null ? "—" : definition.formatValue(metric.value, metric.coaster)}
        </p>
      </div>
    </>
  );

  return (
    <div className="surface-subtle p-3">
      {metric.coaster && onSelectCoaster ? (
        <button
          type="button"
          onClick={() => onSelectCoaster(metric.coaster!)}
          className="interactive-lift flex w-full items-center gap-3 rounded-lg text-left"
        >
          {content}
        </button>
      ) : (
        <div className="flex items-center gap-3">{content}</div>
      )}
      <div
        className={`mt-3 grid gap-2 border-t border-gray-200 pt-3 dark:border-gray-700 ${
          definition.totalLabel && definition.formatTotal ? "grid-cols-2" : "grid-cols-1"
        }`}
      >
        <TinyStat
          label={definition.averageLabel}
          value={metric.average === null ? "—" : definition.formatAverage(metric.average)}
        />
        {definition.totalLabel && definition.formatTotal && (
          <TinyStat
            label={definition.totalLabel}
            value={metric.total === null ? "—" : definition.formatTotal(metric.total)}
          />
        )}
      </div>
    </div>
  );
}

function TinyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );
}
