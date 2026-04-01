import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { CoasterModal, type CoasterSummary } from "../components/CoasterModal";
import { getErrorMessage } from "../lib/errors";
import { ScoreBadge } from "../components/ScoreBadge";

export function MyListPage() {
  const rankings = useQuery(api.rankings.getMyRankings);
  const moveRank = useMutation(api.rankings.moveRank);
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(null);

  if (rankings === undefined) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (rankings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-xl font-semibold text-gray-700 mb-2">No rankings yet</h2>
        <p className="text-gray-500 text-sm">
          Log a ride in the Explore tab to start building your rankings!
        </p>
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
          <h2 className="text-lg font-bold text-gray-800">My List</h2>
          <span className="text-sm text-gray-400">{rankings.length} coasters</span>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Head-to-head logging builds your list. Use arrows here for quick manual tweaks.
        </p>
        <div className="flex flex-col gap-2">
          {rankings.map((item: any, idx: number) => (
            <div
              key={item._id}
              className="bg-white rounded-xl border shadow-sm p-3 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                {idx + 1}
              </div>
              <button
                onClick={() => setSelectedCoaster(item.coaster)}
                className="flex flex-1 min-w-0 items-center gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">
                    {item.coaster?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{item.coaster?.park}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                  item.coaster?.type === "Hybrid" ? "bg-purple-100 text-purple-700" :
                  item.coaster?.type === "Wood" ? "bg-amber-100 text-amber-700" :
                  "bg-blue-100 text-blue-700"
                }`}>
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
      </div>

      {selectedCoaster && (
        <CoasterModal coaster={selectedCoaster} onClose={() => setSelectedCoaster(null)} />
      )}
    </>
  );
}
