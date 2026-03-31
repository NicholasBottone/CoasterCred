import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function SearchPage() {
  const [search, setSearch] = useState("");
  const [selectedCoaster, setSelectedCoaster] = useState<any>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);

  const results = useQuery(api.coasters.search, { q: search });

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex-1">Search Coasters</h2>
        <button
          onClick={() => setShowAddCustom(true)}
          className="text-xs bg-primary text-white px-3 py-1.5 rounded-lg font-medium"
        >
          + Add Custom
        </button>
      </div>

      <input
        type="text"
        placeholder="Search coasters..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 mb-4 text-sm"
      />

      {results === undefined ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {results.map((coaster: any) => (
            <CoasterCard
              key={coaster._id}
              coaster={coaster}
              onClick={() => setSelectedCoaster(coaster)}
            />
          ))}
          {results.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">No coasters found</p>
          )}
        </div>
      )}

      {selectedCoaster && (
        <CoasterModal
          coaster={selectedCoaster}
          onClose={() => setSelectedCoaster(null)}
        />
      )}

      {showAddCustom && (
        <AddCustomModal onClose={() => setShowAddCustom(false)} />
      )}
    </div>
  );
}

function CoasterCard({ coaster, onClick }: { coaster: any; onClick: () => void }) {
  const myLog = useQuery(api.rideLogs.getMyLogForCoaster, { coasterId: coaster._id });

  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl border shadow-sm p-3 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-gray-900 text-sm truncate">{coaster.name}</p>
            {myLog && <span className="text-green-500 text-xs">✓ Ridden</span>}
          </div>
          <p className="text-xs text-gray-500 truncate">{coaster.park} · {coaster.location}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            coaster.type === "Hybrid" ? "bg-purple-100 text-purple-700" :
            coaster.type === "Wood" ? "bg-amber-100 text-amber-700" :
            "bg-blue-100 text-blue-700"
          }`}>
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

function CoasterModal({ coaster, onClose }: { coaster: any; onClose: () => void }) {
  const myLog = useQuery(api.rideLogs.getMyLogForCoaster, { coasterId: coaster._id });
  const rankings = useQuery(api.rankings.getMyRankings);
  const saveRideWithRank = useMutation(api.rankings.saveRideWithRank);
  const removeLog = useMutation(api.rideLogs.removeLog);

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [comparisonBounds, setComparisonBounds] = useState<{ low: number; high: number } | null>(null);
  const loadingData = rankings === undefined || myLog === undefined;

  useEffect(() => {
    setNotes(myLog?.notes ?? "");
    setComparisonBounds(null);
  }, [coaster._id, myLog?._id, myLog?.notes]);

  const rankedCoasters = useMemo(
    () =>
      (rankings ?? []).filter((item: any) => item.coasterId !== coaster._id),
    [coaster._id, rankings],
  );

  const currentRank = rankings?.findIndex((item: any) => item.coasterId === coaster._id);
  const comparisonIndex =
    comparisonBounds === null
      ? null
      : Math.floor((comparisonBounds.low + comparisonBounds.high) / 2);
  const comparisonTarget =
    comparisonIndex === null ? null : rankedCoasters[comparisonIndex];

  const saveAtRank = async (targetRank: number) => {
    setSaving(true);
    try {
      await saveRideWithRank({
        coasterId: coaster._id,
        riddenAt: Date.now(),
        notes: notes || undefined,
        targetRank,
      });
      toast.success(myLog ? "Ride log updated!" : "Ride logged and ranked!");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startComparisonFlow = async () => {
    if (loadingData) return;

    if (rankedCoasters.length === 0) {
      await saveAtRank(1);
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
      await saveAtRank(nextBounds.low + 1);
      return;
    }

    setComparisonBounds(nextBounds);
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await removeLog({ coasterId: coaster._id });
      toast.success("Ride removed");
      onClose();
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

        {/* Stats */}
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
            {myLog ? "Update ride notes and re-rank" : "Log this ride and place it in your list"}
          </p>

          {typeof currentRank === "number" && currentRank >= 0 && (
            <p className="mb-3 text-xs text-gray-500">
              Currently ranked #{currentRank + 1} in your list.
            </p>
          )}

          <textarea
            placeholder="Notes (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-3"
          />

          {loadingData ? (
            <div className="mb-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              Loading your current rankings...
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
                : myLog
                  ? "Start Re-Ranking"
                  : "Start Comparisons"}
            </button>
            {myLog && (
              <button
                onClick={handleRemove}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium disabled:opacity-50"
              >
                Remove
              </button>
            )}
          </div>
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

function AddCustomModal({ onClose }: { onClose: () => void }) {
  const addCustom = useMutation(api.coasters.addCustom);
  const [form, setForm] = useState({
    name: "", park: "", location: "", type: "Steel",
    manufacturer: "", heightFt: "", speedMph: "", lengthFt: "",
    inversions: "", yearOpened: "",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.park || !form.location) {
      toast.error("Name, park, and location are required");
      return;
    }
    setSaving(true);
    try {
      await addCustom({
        name: form.name,
        park: form.park,
        location: form.location,
        type: form.type,
        manufacturer: form.manufacturer || undefined,
        heightFt: form.heightFt ? Number(form.heightFt) : undefined,
        speedMph: form.speedMph ? Number(form.speedMph) : undefined,
        lengthFt: form.lengthFt ? Number(form.lengthFt) : undefined,
        inversions: form.inversions ? Number(form.inversions) : undefined,
        yearOpened: form.yearOpened ? Number(form.yearOpened) : undefined,
      });
      toast.success("Coaster added!");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4 pb-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 my-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">Add Custom Coaster</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {field("name", "Name *")}
          {field("park", "Park *")}
          {field("location", "Location *")}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none"
            >
              <option>Steel</option>
              <option>Wood</option>
              <option>Hybrid</option>
            </select>
          </div>
          {field("manufacturer", "Manufacturer")}
          <div className="grid grid-cols-2 gap-3">
            {field("heightFt", "Height (ft)", "number")}
            {field("speedMph", "Speed (mph)", "number")}
            {field("lengthFt", "Length (ft)", "number")}
            {field("inversions", "Inversions", "number")}
            {field("yearOpened", "Year Opened", "number")}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 mt-1"
          >
            Add Coaster
          </button>
        </form>
      </div>
    </div>
  );
}
