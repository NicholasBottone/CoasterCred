import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CoasterModal, type CoasterSummary } from "../components/CoasterModal";
import { RankingCsvImportModal } from "../components/RankingCsvImportModal";
import { getErrorMessage } from "../lib/errors";
import { ScoreBadge } from "../components/ScoreBadge";
import { getCoasterTypeBadgeClasses } from "../lib/badges";

export function MyListPage() {
  const rankings = useQuery(api.rankings.getMyRankings);
  const moveRank = useMutation(api.rankings.moveRank);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);

  if (rankings === undefined) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const handleMove = async (coasterId: Id<"coasters">, direction: "up" | "down") => {
    try {
      await moveRank({ coasterId, direction });
    } catch (e: any) {
      toast.error(getErrorMessage(e, "Could not update ranking"));
    }
  };

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="ui-copy-disabled text-lg font-bold text-gray-800 dark:text-gray-100">My List</h2>
            <p className="ui-copy-disabled text-xs text-gray-400 dark:text-gray-500">{rankings.length} coasters</p>
          </div>
          <button
            type="button"
            onClick={() => setIsImportOpen(true)}
            className="rounded-xl border border-primary/30 px-3 py-2 text-sm font-semibold text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/5 dark:hover:bg-primary/10"
          >
            Import CSV
          </button>
        </div>
        <p className="ui-copy-disabled mb-3 text-xs text-gray-400 dark:text-gray-500">
          Head-to-head logging builds your list. Use arrows here for quick manual tweaks.
        </p>
        {rankings.length === 0 ? (
          <div className="surface-card flex flex-col items-center justify-center rounded-xl px-4 py-14 text-center">
            <div className="mb-4 text-5xl">🏆</div>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-100">No rankings yet</h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Log rides in Search, or paste a rankings CSV here to build your list faster.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rankings.map((item: any, idx: number) => (
              <div
                key={item._id}
                className="surface-card interactive-lift rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                  {idx + 1}
                </div>
                <button
                  onClick={() => setSelectedCoaster(item.coaster)}
                  className="flex flex-1 min-w-0 items-center gap-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                      {item.coaster?.name ?? "Unknown"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{item.coaster?.park}</p>
                  </div>
                  <span className={getCoasterTypeBadgeClasses(item.coaster?.type)}>
                    {item.coaster?.type}
                  </span>
                  {item.score !== undefined && <ScoreBadge score={item.score} size="sm" />}
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
        <CoasterModal coaster={selectedCoaster} onClose={() => setSelectedCoaster(null)} />
      )}
      {isImportOpen && <RankingCsvImportModal onClose={() => setIsImportOpen(false)} />}
    </>
  );
}
