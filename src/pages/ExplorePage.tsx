import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

export function ExplorePage() {
  const [search, setSearch] = useState("");
  const [selectedCoaster, setSelectedCoaster] = useState<any>(null);
  const [showAddCustom, setShowAddCustom] = useState(false);

  const results = useQuery(api.coasters.search, { q: search });

  return (
    <div className="max-w-lg mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex-1">Explore Coasters</h2>
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
  const logRide = useMutation(api.rideLogs.logRide);
  const removeLog = useMutation(api.rideLogs.removeLog);

  const [rating, setRating] = useState<number>(myLog?.rating ?? 7);
  const [notes, setNotes] = useState(myLog?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleLog = async () => {
    setSaving(true);
    try {
      await logRide({
        coasterId: coaster._id,
        riddenAt: Date.now(),
        rating: rating || undefined,
        notes: notes || undefined,
      });
      toast.success("Ride logged!");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
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
            {myLog ? "Update your ride log" : "Log this ride"}
          </p>

          <div className="mb-3">
            <label className="text-xs text-gray-500 mb-1 block">Rating: {rating}/10</label>
            <input
              type="range"
              min={1}
              max={10}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <textarea
            placeholder="Notes (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none mb-3"
          />

          <div className="flex gap-2">
            <button
              onClick={handleLog}
              disabled={saving}
              className="flex-1 bg-primary text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50"
            >
              {myLog ? "Update Log" : "Log Ride ✓"}
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
