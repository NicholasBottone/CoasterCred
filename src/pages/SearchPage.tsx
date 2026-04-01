import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";
import { dateInputValueToTimestamp, formatDate, todayDateInputValue } from "../lib/dateUtils";

type SearchResult = {
  _id?: string;
  source?: string;
  sourceId?: string;
  sourceUrl?: string;
  lastSyncedAt?: number;
  name: string;
  park: string;
  location: string;
  type: string;
  manufacturer?: string;
  heightFt?: number;
  speedMph?: number;
  lengthFt?: number;
  inversions?: number;
  yearOpened?: number;
};

export function SearchPage() {
  const [search, setSearch] = useState("");
  const [selectedCoaster, setSelectedCoaster] = useState<SearchResult | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
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
          setResults(nextResults as SearchResult[]);
        }
      } catch (error: any) {
        if (!cancelled) {
          setResults([]);
          toast.error(error.message ?? "Could not search Coasterpedia");
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
    : ((topCoasters ?? []) as SearchResult[]);

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-800">Search Coasters</h2>
        <p className="text-xs text-gray-400 mt-1">
          Search Coasterpedia live. A coaster only enters our database once someone logs it.
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

function CoasterCard({ coaster, onClick }: { coaster: SearchResult; onClick: () => void }) {
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
            {!coaster._id && coaster.source === "coasterpedia" && (
              <span className="text-[10px] uppercase tracking-wide bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Live
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

function CoasterModal({ coaster, onClose }: { coaster: SearchResult; onClose: () => void }) {
  const [localCoasterId, setLocalCoasterId] = useState<string | undefined>(coaster._id);
  const myLogs = useQuery(
    api.rideLogs.getMyLogsForCoaster,
    localCoasterId ? { coasterId: localCoasterId as any } : "skip",
  );
  const rankings = useQuery(api.rankings.getMyRankings);
  const saveRideWithRank = useMutation(api.rankings.saveRideWithRank);
  const removeLog = useMutation(api.rideLogs.removeLog);
  const materializeCoaster = useAction(api.coasters.materializeCoasterpediaCoaster);

  const [notes, setNotes] = useState("");
  const [rideDate, setRideDate] = useState(todayDateInputValue());
  const [saving, setSaving] = useState(false);
  const [comparisonBounds, setComparisonBounds] = useState<{ low: number; high: number } | null>(null);
  const loadingData = rankings === undefined || (localCoasterId !== undefined && myLogs === undefined);
  const rideHistory = myLogs ?? [];

  useEffect(() => {
    setLocalCoasterId(coaster._id);
    setNotes("");
    setRideDate(todayDateInputValue());
    setComparisonBounds(null);
  }, [coaster._id, coaster.sourceId]);

  const rankedCoasters = useMemo(
    () =>
      (rankings ?? []).filter((item: any) => item.coasterId !== localCoasterId),
    [localCoasterId, rankings],
  );

  const currentRank = rankings?.findIndex((item: any) => item.coasterId === localCoasterId);
  const comparisonIndex =
    comparisonBounds === null
      ? null
      : Math.floor((comparisonBounds.low + comparisonBounds.high) / 2);
  const comparisonTarget =
    comparisonIndex === null ? null : rankedCoasters[comparisonIndex];

  const ensureLocalCoasterId = async () => {
    if (localCoasterId) return localCoasterId;
    if (coaster.source === "coasterpedia" && coaster.sourceId) {
      const nextId = (await materializeCoaster({ sourceId: coaster.sourceId })) as string;
      setLocalCoasterId(nextId);
      return nextId;
    }
    throw new Error("Could not create a local coaster record");
  };

  const saveRide = async (targetRank?: number) => {
    setSaving(true);
    try {
      const coasterId = await ensureLocalCoasterId();
      await saveRideWithRank({
        coasterId: coasterId as any,
        riddenAt: dateInputValueToTimestamp(rideDate),
        rideDate,
        notes: notes || undefined,
        targetRank,
      });
      toast.success(
        currentRank !== undefined && currentRank >= 0 && targetRank === undefined
          ? "Ride added to your history!"
          : "Ride logged and ranked!",
      );
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startComparisonFlow = async () => {
    if (loadingData) return;

    if (currentRank !== undefined && currentRank >= 0) {
      await saveRide();
      return;
    }

    if (rankedCoasters.length === 0) {
      await saveRide(1);
      return;
    }

    setComparisonBounds({ low: 0, high: rankedCoasters.length });
  };

  const handleComparisonChoice = async (winner: "selected" | "other") => {
    if (comparisonBounds === null || comparisonTarget === null) return;

    const mid = Math.floor((comparisonBounds.low + comparisonBounds.high) / 2);
    const nextBounds =
      winner === "selected"
        ? { low: comparisonBounds.low, high: mid }
        : { low: mid + 1, high: comparisonBounds.high };

    if (nextBounds.low >= nextBounds.high) {
      await saveRide(nextBounds.low + 1);
      return;
    }

    setComparisonBounds(nextBounds);
  };

  const handleRemove = async (logId: string) => {
    setSaving(true);
    try {
      await removeLog({ logId: logId as any });
      toast.success("Ride removed");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{coaster.name}</h3>
            <p className="text-sm text-gray-500">{coaster.park} · {coaster.location}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {coaster.heightFt && <Stat label="Height" value={`${coaster.heightFt}ft`} />}
          {coaster.speedMph && <Stat label="Speed" value={`${coaster.speedMph}mph`} />}
          {coaster.inversions !== undefined && <Stat label="Inversions" value={coaster.inversions} />}
          {coaster.lengthFt && <Stat label="Length" value={`${coaster.lengthFt}ft`} />}
          {coaster.yearOpened && <Stat label="Opened" value={coaster.yearOpened} />}
          {coaster.manufacturer && <Stat label="Maker" value={coaster.manufacturer} />}
        </div>

        <div className="border-t pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">
            {rideHistory.length > 0
              ? "Add another ride to your history or re-rank this coaster"
              : "Log this ride and place it in your list"}
          </p>

          {typeof currentRank === "number" && currentRank >= 0 && (
            <p className="mb-3 text-xs text-gray-500">
              Currently ranked #{currentRank + 1} in your list.
            </p>
          )}

          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Ride date</label>
            <input
              type="date"
              value={rideDate}
              max={todayDateInputValue()}
              onChange={(e) => setRideDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="mt-1 text-xs text-gray-400">
              Historical rides are supported. You can only log this coaster once per day.
            </p>
          </div>

          <textarea
            placeholder="Notes (optional)..."
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-3"
          />

          {loadingData ? (
            <div className="mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Loading your current rankings...
            </div>
          ) : currentRank !== undefined && currentRank >= 0 && comparisonTarget === null ? (
            <div className="mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              This coaster is already in your list, so a repeat ride adds trip history without creating another leaderboard credit.
            </div>
          ) : comparisonTarget ? (
            <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Which coaster is better?
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => void handleComparisonChoice("selected")}
                  disabled={saving}
                  className="rounded-xl border border-primary/20 bg-white px-3 py-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  <p className="text-sm font-semibold text-gray-900">{coaster.name}</p>
                  <p className="text-xs text-gray-500">{coaster.park}</p>
                </button>
                <button
                  onClick={() => void handleComparisonChoice("other")}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-left shadow-sm transition hover:border-gray-300 hover:bg-gray-100 disabled:opacity-50"
                >
                  <p className="text-sm font-semibold text-gray-900">
                    {comparisonTarget.coaster?.name ?? "Unknown"}
                  </p>
                  <p className="text-xs text-gray-500">{comparisonTarget.coaster?.park}</p>
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Pick the coaster you’d place higher in your personal rankings.
              </p>
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {rankedCoasters.length === 0
                ? "This will become your first ranked coaster."
                : "Start the comparison flow to place this coaster into your list."}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => void startComparisonFlow()}
              disabled={saving || loadingData}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {comparisonTarget
                ? "Restart Comparisons"
                : currentRank !== undefined && currentRank >= 0
                  ? "Log Ride"
                  : "Start Comparisons"}
            </button>
            {currentRank !== undefined && currentRank >= 0 && (
              <button
                onClick={() => setComparisonBounds({ low: 0, high: rankedCoasters.length })}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-primary/30 text-primary text-sm font-medium disabled:opacity-50"
              >
                Re-rank
              </button>
            )}
          </div>

          {rideHistory.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-800">Ride History</h4>
                <span className="text-xs text-gray-400">{rideHistory.length} logged</span>
              </div>
              <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                {rideHistory.map((log: any) => (
                  <div
                    key={log._id}
                    className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{formatDate(log.rideDate)}</p>
                      {log.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 break-words">{log.notes}</p>
                      )}
                    </div>
                    <button
                      onClick={() => void handleRemove(log._id)}
                      disabled={saving}
                      className="text-xs text-red-500 font-medium disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2 text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
