import { Trophy } from "lucide-react";
import { PageHeading } from "../components/TrackMotif";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CoasterModal } from "../components/CoasterModal";
import { RankingCsvImportModal } from "../components/RankingCsvImportModal";
import { type CoasterSummary } from "../lib/coasterData";
import { getErrorMessage } from "../lib/errors";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterMaterialClasses } from "../lib/badges";

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function timestampToDateValue(timestamp: number | null | undefined) {
  if (!timestamp) return "";
  return new Date(timestamp).toISOString().slice(0, 10);
}

function buildRankingsCsv(rankings: any[]) {
  const rows = [
    ["Rank", "Name", "Park", "Last Ridden"],
    ...rankings.map((item, index) => [
      index + 1,
      item.coaster?.name ?? "",
      item.coaster?.park ?? "",
      item.log?.rideDate ?? timestampToDateValue(item.log?.riddenAt),
    ]),
  ];

  return rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export function MyListPage() {
  const rankings = useQuery(api.rankings.getMyRankings);
  const moveRank = useMutation(api.rankings.moveRank);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(
    null,
  );
  const [isImportOpen, setIsImportOpen] = useState(false);

  if (rankings === undefined) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleMove = async (
    coasterId: Id<"coasters">,
    direction: "up" | "down",
  ) => {
    try {
      await moveRank({ coasterId, direction });
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not update ranking"));
    }
  };

  const handleExportCsv = () => {
    if (rankings.length === 0) {
      toast.error("There are no coasters to export yet.");
      return;
    }

    const csv = buildRankingsCsv(rankings);
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `coastercred-rankings-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Exported your rankings CSV.");
  };

  return (
    <>
      <div className="page-content">
        <div
          className="my-list-heading"
          data-onboarding-target="my-list-summary"
        >
          <PageHeading
            title="My List"
            motif="roll"
            subtitle={
              <p className="ui-copy-disabled text-xs text-gray-400 dark:text-gray-500">
                {rankings.length} coasters
              </p>
            }
          />
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="ui-copy-disabled flex-1 text-xs text-gray-400 dark:text-gray-500">
              Head-to-head logging builds your list. Use arrows here for quick
              manual tweaks.
            </p>
            <div className="flex items-center gap-2">
              <div className="group relative">
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={rankings.length === 0}
                  aria-label="Export CSV"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path
                      d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0  transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-gray-100 dark:text-gray-900"
                >
                  Export CSV
                </span>
              </div>
              <div className="group relative">
                <button
                  type="button"
                  onClick={() => setIsImportOpen(true)}
                  aria-label="Import CSV"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-primary/30 text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-primary/10"
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="h-5 w-5"
                  >
                    <path
                      d="M12 15V3m0 0 4 4m-4-4-4 4M5 17v3h14v-3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute right-0 top-full z-10 mt-2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white opacity-0  transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:bg-gray-100 dark:text-gray-900"
                >
                  Import CSV
                </span>
              </div>
            </div>
          </div>
        </div>
        {rankings.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center rounded-md px-4 py-14 text-center">
            <Trophy
              className="mb-4 h-10 w-10 text-primary"
              aria-hidden="true"
            />
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-100">
              No rankings yet
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Log rides in Search, or paste a rankings CSV here to build your
              list faster.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rankings.map((item: any, idx: number) => (
              <div key={item._id} className="flat-row flex items-center gap-3">
                <div className="rank-number shrink-0 text-sm">{idx + 1}</div>
                <button
                  onClick={() => setSelectedCoaster(item.coaster)}
                  className="flex flex-1 min-w-0 items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                      {item.coaster?.name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {item.coaster?.park}
                    </p>
                  </div>
                  <span
                    className={getCoasterMaterialClasses(item.coaster?.type)}
                  >
                    {item.coaster?.type}
                  </span>
                  {item.score !== undefined && (
                    <ScoreBadge score={item.score} size="sm" />
                  )}
                </button>
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => handleMove(item.coasterId, "up")}
                    disabled={idx === 0}
                    className="text-gray-400 hover:text-primary disabled:opacity-20 text-xs leading-none px-1"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => handleMove(item.coasterId, "down")}
                    disabled={idx === rankings.length - 1}
                    className="text-gray-400 hover:text-primary disabled:opacity-20 text-xs leading-none px-1"
                  >
                    ▼
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedCoaster && (
        <CoasterModal
          coaster={selectedCoaster}
          onClose={() => setSelectedCoaster(null)}
        />
      )}
      {isImportOpen && (
        <RankingCsvImportModal onClose={() => setIsImportOpen(false)} />
      )}
    </>
  );
}
