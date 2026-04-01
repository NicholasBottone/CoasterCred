import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { CoasterModal, type CoasterSummary } from "../components/CoasterModal";
import { getErrorMessage } from "../lib/errors";

export function SearchPage() {
  const [search, setSearch] = useState("");
  const [selectedCoaster, setSelectedCoaster] = useState<CoasterSummary | null>(null);
  const [results, setResults] = useState<CoasterSummary[]>([]);
  const [searching, setSearching] = useState(false);

  const topCoasters = useQuery(api.coasters.getTopCoasters);
  const searchCoasterpedia = useAction(api.coasters.searchCoasterpedia);

  useEffect(() => {
    const queryText = search.trim();
    if (!queryText) {
      setResults([]);
      setSearching(false);
      return;
    }

    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const nextResults = await searchCoasterpedia({ q: queryText });
        if (!cancelled) {
          setResults(nextResults as CoasterSummary[]);
        }
      } catch (error: any) {
        if (!cancelled) {
          setResults([]);
          toast.error(getErrorMessage(error, "Could not search coasters"));
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [search, searchCoasterpedia]);

  const displayResults = search.trim()
    ? results
    : ((topCoasters ?? []) as CoasterSummary[]);

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800">Search Coasters</h2>
        <p className="text-xs text-gray-400 mt-1">Search by coaster name or park to log a ride.</p>
        <p className="text-xs text-gray-400 mt-1">
          Coaster data by{" "}
          <a
            href="https://coasterpedia.net/"
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline"
          >
            Coasterpedia
          </a>
          .
        </p>
      </div>

      <input
        type="text"
        placeholder="Search coasters..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4 text-sm"
      />

      {searching || (!topCoasters && !search.trim()) ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {displayResults.map((coaster) => (
            <CoasterCard
              key={coaster._id ?? `${coaster.source ?? "local"}:${coaster.sourceId ?? coaster.name}`}
              coaster={coaster}
              onClick={() => setSelectedCoaster(coaster)}
            />
          ))}
          {displayResults.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              {search.trim() ? "No coasters found" : "No local coasters yet"}
            </p>
          )}
        </div>
      )}

      {selectedCoaster && (
        <CoasterModal
          coaster={selectedCoaster}
          onClose={() => setSelectedCoaster(null)}
        />
      )}
    </div>
  );
}

function CoasterCard({ coaster, onClick }: { coaster: CoasterSummary; onClick: () => void }) {
  const myLogs = useQuery(
    api.rideLogs.getMyLogsForCoaster,
    coaster._id ? { coasterId: coaster._id as any } : "skip",
  );
  const rideCount = myLogs?.length ?? 0;

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border shadow-sm p-3 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{coaster.name}</p>
            {rideCount > 0 && (
              <span className="text-green-500 text-xs">
                ✓ {rideCount === 1 ? "Ridden" : `${rideCount} rides`}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate">{coaster.park} · {coaster.location}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              coaster.type === "Hybrid"
                ? "bg-purple-100 text-purple-700"
                : coaster.type === "Wood"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700"
            }`}
          >
            {coaster.type}
          </span>
          {coaster.heightFt && (
            <span className="text-xs text-gray-400">{coaster.heightFt}ft</span>
          )}
        </div>
      </div>
    </button>
  );
}
