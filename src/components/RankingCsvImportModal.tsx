import { useEffect, useMemo, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import { dateInputValueToTimestamp, formatDate } from "../lib/dateUtils";
import { getErrorMessage } from "../lib/errors";
import { getCoasterTypeBadgeClasses } from "../lib/badges";
import { useScrollToTop } from "../hooks/useScrollToTop";
import { ModalCloseButton, ModalContainer } from "./ModalContainer";

type ImportRow = {
  rowNumber: number;
  rank: string;
  name: string;
  park: string;
  lastRidden: string;
  status: "pending" | "imported" | "skipped";
};

type ImportCandidate = {
  _id?: string;
  source?: string;
  sourceId?: string;
  sourcePageId?: string;
  sourceUrl?: string;
  name: string;
  parentName?: string;
  park: string;
  location: string;
  type: string;
  isMultiTrack?: boolean;
  multiTrackGroupId?: string;
  trackName?: string;
  trackIndex?: number;
  nameMatches: boolean;
  parkMatches: boolean;
  parentNameMatches?: boolean;
};

type ImportIssue = {
  code: string;
  message: string;
  fieldNames: string[];
};

type ValidationResult = {
  normalizedName: string;
  exactMatch: ImportCandidate | null;
  candidates: ImportCandidate[];
  issue: ImportIssue | null;
};

type RowErrors = Partial<Record<"rank" | "name" | "park" | "lastRidden", string>>;

function parseCsvRows(text: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentValue += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        currentValue += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if (char === "\r") {
      if (nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += char;
  }

  if (inQuotes) {
    throw new Error("The pasted CSV has an unclosed quoted value.");
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function parseImportRows(csvText: string): ImportRow[] {
  const parsedRows = parseCsvRows(csvText);
  const nonBlankRows = parsedRows.filter((row) => row.some((value) => value.trim() !== ""));
  if (nonBlankRows.length === 0) {
    throw new Error("Paste a CSV file to start importing.");
  }

  const headers = nonBlankRows[0].map((value, index) =>
    (index === 0 ? value.replace(/^\uFEFF/, "") : value).trim().toLowerCase(),
  );
  const requiredHeaders = ["rank", "name", "park", "last ridden"] as const;
  const columnIndexes = requiredHeaders.map((header) => headers.indexOf(header));

  if (columnIndexes.some((index) => index === -1)) {
    throw new Error("Expected columns: Rank, Name, Park, Last Ridden.");
  }

  return nonBlankRows.slice(1).map((row, index) => ({
    rowNumber: index + 2,
    rank: row[columnIndexes[0]]?.trim() ?? "",
    name: row[columnIndexes[1]]?.trim() ?? "",
    park: row[columnIndexes[2]]?.trim() ?? "",
    lastRidden: row[columnIndexes[3]]?.trim() ?? "",
    status: "pending",
  }));
}

function parsePositiveRank(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "Rank is required." };
  }

  if (!/^\d+$/.test(trimmed)) {
    return { error: "Rank must be a whole number." };
  }

  const rank = Number(trimmed);
  if (rank <= 0) {
    return { error: "Rank must be at least 1." };
  }

  return { value: rank };
}

function buildIsoDate(year: number, month: number, day: number) {
  const isoDate = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return isoDate;
}

function parseRideDateValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "Last ridden is required." };
  }

  if (/^\d{4}$/.test(trimmed)) {
    return {
      value: `${trimmed}-01-01`,
      wasYearOnly: true,
    };
  }

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const isoDate = buildIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    if (!isoDate) {
      return { error: "Last ridden must be a real date." };
    }
    return { value: isoDate, wasYearOnly: false };
  }

  const usMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (usMatch) {
    const isoDate = buildIsoDate(Number(usMatch[3]), Number(usMatch[1]), Number(usMatch[2]));
    if (!isoDate) {
      return { error: "Last ridden must be a real date." };
    }
    return { value: isoDate, wasYearOnly: false };
  }

  return { error: "Last ridden must be a year or a date like 2025-05-03." };
}

function getRowErrors(row: ImportRow): RowErrors {
  const errors: RowErrors = {};

  const rankResult = parsePositiveRank(row.rank);
  if ("error" in rankResult) {
    errors.rank = rankResult.error;
  }

  if (!row.name.trim()) {
    errors.name = "Coaster name is required.";
  }

  if (!row.park.trim()) {
    errors.park = "Park is required.";
  }

  const rideDateResult = parseRideDateValue(row.lastRidden);
  if ("error" in rideDateResult) {
    errors.lastRidden = rideDateResult.error;
  }

  return errors;
}

function getResolvedDateLabel(row: ImportRow) {
  const rideDateResult = parseRideDateValue(row.lastRidden);
  if ("error" in rideDateResult) return null;

  return {
    isoDate: rideDateResult.value,
    displayDate: formatDate(rideDateResult.value),
    wasYearOnly: rideDateResult.wasYearOnly,
  };
}

function fieldHasServerIssue(fieldName: keyof RowErrors, issue: ImportIssue | null) {
  return issue?.fieldNames.includes(fieldName) ?? false;
}

export function RankingCsvImportModal({ onClose }: { onClose: () => void }) {
  const [csvText, setCsvText] = useState("");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState<"paste" | "review" | "complete">("paste");
  const [csvError, setCsvError] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const scrollRef = useScrollToTop([stage, currentIndex]);

  const validateRankingImportRow = useAction(api.coasters.validateRankingImportRow);
  const materializeCoaster = useAction(api.coasters.materializeCoasterpediaCoaster);
  const saveRideWithRank = useMutation(api.rankings.saveRideWithRank);

  const currentRow = rows[currentIndex] ?? null;
  const currentErrors = useMemo(() => (currentRow ? getRowErrors(currentRow) : {}), [currentRow]);
  const resolvedDate = useMemo(() => (currentRow ? getResolvedDateLabel(currentRow) : null), [currentRow]);
  const importedCount = rows.filter((row) => row.status === "imported").length;
  const skippedCount = rows.filter((row) => row.status === "skipped").length;
  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const canImportCurrentRow =
    currentRow !== null &&
    Object.keys(currentErrors).length === 0 &&
    Boolean(validationResult?.exactMatch) &&
    !isResolving &&
    !isImporting;

  useEffect(() => {
    if (stage !== "review" || !currentRow) {
      setValidationResult(null);
      setIsResolving(false);
      return;
    }

    if (Object.keys(currentErrors).length > 0) {
      setValidationResult(null);
      setIsResolving(false);
      return;
    }

    let cancelled = false;
    setIsResolving(true);
    setValidationResult(null);

    const timeout = window.setTimeout(async () => {
      try {
        const result = (await validateRankingImportRow({
          name: currentRow.name,
          park: currentRow.park,
        })) as ValidationResult;

        if (!cancelled) {
          setValidationResult(result);
        }
      } catch (error) {
        if (!cancelled) {
          setValidationResult({
            normalizedName: currentRow.name.trim(),
            exactMatch: null,
            candidates: [],
            issue: {
              code: "validation_error",
              message: getErrorMessage(error, "Could not validate this row against Coasterpedia."),
              fieldNames: ["name", "park"],
            },
          });
        }
      } finally {
        if (!cancelled) {
          setIsResolving(false);
        }
      }
    }, 150);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [currentErrors, currentRow, stage, validateRankingImportRow]);

  const handleStartImport = () => {
    try {
      const parsedRows = parseImportRows(csvText);
      if (parsedRows.length === 0) {
        throw new Error("The pasted CSV does not contain any ranking rows.");
      }
      setRows(parsedRows);
      setCurrentIndex(0);
      setCsvError(null);
      setStage("review");
    } catch (error) {
      setCsvError(getErrorMessage(error, "Could not parse the pasted CSV."));
    }
  };

  const updateCurrentRow = (patch: Partial<ImportRow>) => {
    if (!currentRow) return;
    setRows((previousRows) =>
      previousRows.map((row, index) =>
        index === currentIndex
          ? {
              ...row,
              ...patch,
            }
          : row,
      ),
    );
  };

  const applyCandidate = (candidate: ImportCandidate) => {
    updateCurrentRow({
      name: candidate.name,
      park: candidate.park,
    });
  };

  const moveToNextPendingRow = (nextStatus: ImportRow["status"]) => {
    if (!currentRow) return;

    const nextRows = rows.map((row, index) =>
      index === currentIndex
        ? {
            ...row,
            status: nextStatus,
          }
        : row,
    );
    const nextPendingIndex = nextRows.findIndex(
      (row, index) => index > currentIndex && row.status === "pending",
    );

    setRows(nextRows);

    if (nextPendingIndex === -1) {
      setStage("complete");
      return;
    }

    setCurrentIndex(nextPendingIndex);
  };

  const importCurrentRow = async () => {
    if (!currentRow || !validationResult?.exactMatch || !resolvedDate) return;

    const rankResult = parsePositiveRank(currentRow.rank);
    if ("error" in rankResult) return;

    setIsImporting(true);
    try {
      let coasterId = validationResult.exactMatch._id;
      if (!coasterId && validationResult.exactMatch.sourceId) {
        coasterId = (await materializeCoaster({
          sourceId: validationResult.exactMatch.sourceId,
        })) as string;
      }

      if (!coasterId) {
        throw new Error("Could not resolve this coaster to a local record.");
      }

      await saveRideWithRank({
        coasterId: coasterId as any,
        riddenAt: dateInputValueToTimestamp(resolvedDate.isoDate),
        rideDate: resolvedDate.isoDate,
        targetRank: rankResult.value,
      });

      toast.success(`Imported row ${currentRow.rowNumber}`);
      moveToNextPendingRow("imported");
    } catch (error) {
      toast.error(getErrorMessage(error, "Could not import this row."));
    } finally {
      setIsImporting(false);
    }
  };

  const skipCurrentRow = () => {
    if (!currentRow || isImporting) return;
    moveToNextPendingRow("skipped");
    toast.success(`Skipped row ${currentRow.rowNumber}`);
  };

  return (
    <ModalContainer onClose={onClose} maxWidth="2xl" scrollRef={scrollRef}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Import Rankings CSV</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Paste rankings in the Sloth-style CSV format and import them one row at a time.
          </p>
        </div>
        <ModalCloseButton onClose={onClose} />
      </div>

      {stage === "paste" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
            Expected columns: <span className="font-medium">Rank, Name, Park, Last Ridden</span>.
            Year-only dates will import as January 1 of that year.
          </div>

          <textarea
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder={"Rank,Name,Park,Last Ridden\n1,Steel Vengeance,Cedar Point,2025"}
            className="input-field min-h-64 resize-y font-mono text-sm"
          />

          {csvError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-200">
              {csvError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-primary/30 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/5 dark:hover:bg-primary/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleStartImport}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md"
            >
              Start Import
            </button>
          </div>
        </div>
      )}

      {stage === "review" && currentRow && (
        <div className="space-y-4">
          <div className="surface-card rounded-xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Item {currentIndex + 1} of {rows.length}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  CSV line {currentRow.rowNumber} · {importedCount} imported, {skippedCount} skipped, {pendingCount} remaining
                </p>
              </div>
              <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Next rank: #{currentRow.rank || "?"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Rank
              </span>
              <input
                type="text"
                value={currentRow.rank}
                onChange={(event) => updateCurrentRow({ rank: event.target.value })}
                className={`input-field ${currentErrors.rank ? "border-red-300 focus:ring-red-200 dark:border-red-800" : ""}`}
              />
              {currentErrors.rank && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{currentErrors.rank}</p>}
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Last ridden
              </span>
              <input
                type="text"
                value={currentRow.lastRidden}
                onChange={(event) => updateCurrentRow({ lastRidden: event.target.value })}
                className={`input-field ${
                  currentErrors.lastRidden ? "border-red-300 focus:ring-red-200 dark:border-red-800" : ""
                }`}
              />
              {currentErrors.lastRidden ? (
                <p className="mt-1 text-xs text-red-600 dark:text-red-300">{currentErrors.lastRidden}</p>
              ) : resolvedDate ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Imports as {resolvedDate.displayDate}
                  {resolvedDate.wasYearOnly ? " because year-only dates use January 1." : "."}
                </p>
              ) : null}
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Coaster name
            </span>
            <input
              type="text"
              value={currentRow.name}
              onChange={(event) => updateCurrentRow({ name: event.target.value })}
              className={`input-field ${
                currentErrors.name || fieldHasServerIssue("name", validationResult?.issue ?? null)
                  ? "border-red-300 focus:ring-red-200 dark:border-red-800"
                  : ""
              }`}
            />
            {currentErrors.name && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{currentErrors.name}</p>}
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Park
            </span>
            <input
              type="text"
              value={currentRow.park}
              onChange={(event) => updateCurrentRow({ park: event.target.value })}
              className={`input-field ${
                currentErrors.park || fieldHasServerIssue("park", validationResult?.issue ?? null)
                  ? "border-red-300 focus:ring-red-200 dark:border-red-800"
                  : ""
              }`}
            />
            {currentErrors.park && <p className="mt-1 text-xs text-red-600 dark:text-red-300">{currentErrors.park}</p>}
          </label>

          {isResolving && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-300">
              Validating this coaster against Coasterpedia...
            </div>
          )}

          {!isResolving && validationResult?.issue && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/50 dark:text-amber-200">
              {validationResult.issue.message}
              {validationResult.normalizedName !== currentRow.name.trim() && (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Matching ignores park-code suffixes, so this row is being searched as "{validationResult.normalizedName}".
                </p>
              )}
            </div>
          )}

          {!isResolving && validationResult?.exactMatch && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 dark:border-green-900/60 dark:bg-green-950/40">
              <p className="text-sm font-semibold text-green-800 dark:text-green-200">Exact Coasterpedia match found</p>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900 dark:text-gray-100">
                    {validationResult.exactMatch.name}
                  </p>
                  <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                    {validationResult.exactMatch.park} · {validationResult.exactMatch.location}
                  </p>
                </div>
                <span className={getCoasterTypeBadgeClasses(validationResult.exactMatch.type)}>
                  {validationResult.exactMatch.type}
                </span>
              </div>
            </div>
          )}

          {!isResolving && validationResult && validationResult.candidates.length > 0 && !validationResult.exactMatch && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {validationResult.issue?.code === "track_required" ? "Choose a track" : "Nearby matches"}
              </p>
              {validationResult.candidates.slice(0, 6).map((candidate) => (
                <div
                  key={`${candidate.source ?? "coasterpedia"}:${candidate.sourceId ?? candidate.name}`}
                  className="surface-card rounded-xl p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{candidate.name}</p>
                      <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                        {candidate.park} · {candidate.location}
                      </p>
                      {validationResult.issue?.code === "track_required" ? (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          Exact track option for {candidate.parentName ?? candidate.name}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          {candidate.nameMatches ? "Name matches" : "Name differs"} · {candidate.parkMatches ? "Park matches" : "Park differs"}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <span className={getCoasterTypeBadgeClasses(candidate.type)}>{candidate.type}</span>
                      <button
                        type="button"
                        onClick={() => applyCandidate(candidate)}
                        className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/5 dark:hover:bg-primary/10"
                      >
                        Use this match
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setStage("paste")}
              className="rounded-xl border border-primary/30 px-4 py-2.5 text-sm font-medium text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/5 dark:hover:bg-primary/10"
            >
              Back to CSV
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={skipCurrentRow}
                disabled={isImporting}
                className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-all hover:-translate-y-0.5 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Skip Row
              </button>
              <button
                type="button"
                onClick={importCurrentRow}
                disabled={!canImportCurrentRow}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isImporting ? "Importing..." : "Import This Row"}
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === "complete" && (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-3xl text-primary">
            ✓
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">Import complete</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Imported {importedCount} ranking rows into your list{skippedCount > 0 ? ` and skipped ${skippedCount}.` : "."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 hover:bg-primary-hover hover:shadow-md"
          >
            Done
          </button>
        </div>
      )}
    </ModalContainer>
  );
}
