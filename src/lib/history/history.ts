/**
 * Measurement history: pure helpers for building, storing and summarising readings.
 * No browser APIs here — the storage hook wraps these with localStorage.
 */

export type Reading = {
  id: string;
  takenAt: number; // epoch ms
  heartRate: number; // bpm — every saved reading has one
  breathingRate: number | null; // breaths/min
  rmssd: number | null; // ms
  confidence: number; // 0–1
};

export type Metric = "heartRate" | "breathingRate" | "rmssd";
export type Range = "7d" | "30d" | "all";

/** Oldest readings are dropped past this count to keep storage small. */
export const MAX_READINGS = 500;
const DAY_MS = 86_400_000;

const round1 = (v: number) => Math.round(v * 10) / 10;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Turn a finished measurement into a reading, or null when no clear pulse was found. */
export function makeReading(
  est: { heartRate: number | null; breathingRate: number | null; rmssd: number | null; confidence: number },
  takenAt: number,
): Reading | null {
  if (!finite(est.heartRate)) return null;
  return {
    id: `r-${takenAt}`,
    takenAt,
    heartRate: round1(est.heartRate),
    breathingRate: finite(est.breathingRate) ? round1(est.breathingRate) : null,
    rmssd: finite(est.rmssd) ? round1(est.rmssd) : null,
    confidence: Math.round(Math.min(1, Math.max(0, est.confidence)) * 100) / 100,
  };
}

/** Add a reading (ignoring duplicates by id), newest first, capped at MAX_READINGS. */
export function addReading(list: Reading[], reading: Reading): Reading[] {
  if (list.some((r) => r.id === reading.id)) return list;
  return [reading, ...list].sort((a, b) => b.takenAt - a.takenAt).slice(0, MAX_READINGS);
}

export function removeReading(list: Reading[], id: string): Reading[] {
  return list.filter((r) => r.id !== id);
}

/** Parse stored JSON defensively: bad or foreign data yields an empty or filtered list. */
export function parseHistory(raw: string | null): Reading[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const out: Reading[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    if (typeof r["id"] !== "string" || !finite(r["takenAt"]) || !finite(r["heartRate"])) continue;
    out.push({
      id: r["id"],
      takenAt: r["takenAt"],
      heartRate: r["heartRate"],
      breathingRate: finite(r["breathingRate"]) ? r["breathingRate"] : null,
      rmssd: finite(r["rmssd"]) ? r["rmssd"] : null,
      confidence: finite(r["confidence"]) ? r["confidence"] : 0,
    });
  }
  return out.sort((a, b) => b.takenAt - a.takenAt).slice(0, MAX_READINGS);
}

export function filterByRange(list: Reading[], range: Range, now: number): Reading[] {
  if (range === "all") return list;
  const cutoff = now - (range === "7d" ? 7 : 30) * DAY_MS;
  return list.filter((r) => r.takenAt >= cutoff);
}

export type Summary = {
  count: number;
  latest: number;
  average: number;
  min: number;
  max: number;
  /** Latest reading minus the average of the earlier ones in the set; null with fewer than 2. */
  changeVsEarlier: number | null;
};

/** Summarise one metric over a set of readings (any order). Null when no reading has it. */
export function summarize(list: Reading[], metric: Metric): Summary | null {
  const points = list
    .filter((r) => finite(r[metric]))
    .sort((a, b) => a.takenAt - b.takenAt)
    .map((r) => r[metric] as number);
  if (points.length === 0) return null;
  const latest = points[points.length - 1]!;
  const earlier = points.slice(0, -1);
  const avg = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  return {
    count: points.length,
    latest,
    average: round1(avg(points)),
    min: Math.min(...points),
    max: Math.max(...points),
    changeVsEarlier: earlier.length ? round1(latest - avg(earlier)) : null,
  };
}

/** Oldest-first chart points for one metric, skipping readings without it. */
export function series(list: Reading[], metric: Metric): { t: number; value: number }[] {
  return list
    .filter((r) => finite(r[metric]))
    .map((r) => ({ t: r.takenAt, value: r[metric] as number }))
    .sort((a, b) => a.t - b.t);
}
