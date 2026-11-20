import { describe, expect, it } from "vitest";
import {
  MAX_READINGS,
  addReading,
  filterByRange,
  makeReading,
  parseHistory,
  removeReading,
  series,
  summarize,
  type Reading,
} from "./history";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 20, 10, 0);

function reading(daysAgo: number, hr: number, rr: number | null = 14, hrv: number | null = 40): Reading {
  const takenAt = NOW - daysAgo * DAY;
  return { id: `r-${takenAt}`, takenAt, heartRate: hr, breathingRate: rr, rmssd: hrv, confidence: 0.8 };
}

describe("makeReading", () => {
  it("saves a completed measurement that found a pulse", () => {
    const r = makeReading({ heartRate: 72.46, breathingRate: 15.04, rmssd: 38.27, confidence: 0.9 }, NOW);
    expect(r).toEqual({ id: `r-${NOW}`, takenAt: NOW, heartRate: 72.5, breathingRate: 15, rmssd: 38.3, confidence: 0.9 });
  });

  it("does not save a measurement without a heart rate", () => {
    expect(makeReading({ heartRate: null, breathingRate: 15, rmssd: 40, confidence: 0.1 }, NOW)).toBeNull();
  });

  it("keeps a reading when breathing or HRV are missing", () => {
    const r = makeReading({ heartRate: 64, breathingRate: null, rmssd: null, confidence: 0.5 }, NOW);
    expect(r?.breathingRate).toBeNull();
    expect(r?.rmssd).toBeNull();
  });
});

describe("addReading / removeReading", () => {
  it("does not save the same measurement twice", () => {
    const r = reading(0, 70);
    expect(addReading(addReading([], r), r)).toHaveLength(1);
  });

  it("keeps newest first and caps the history", () => {
    let list: Reading[] = [];
    for (let i = 0; i < MAX_READINGS + 5; i++) list = addReading(list, reading(i / 10, 60 + (i % 20)));
    expect(list).toHaveLength(MAX_READINGS);
    expect(list[0]!.takenAt).toBe(NOW);
  });

  it("removes a single reading by id", () => {
    const a = reading(1, 60), b = reading(0, 70);
    expect(removeReading([b, a], a.id)).toEqual([b]);
  });
});

describe("parseHistory", () => {
  it("returns an empty history for missing or corrupt data", () => {
    expect(parseHistory(null)).toEqual([]);
    expect(parseHistory("{not json")).toEqual([]);
    expect(parseHistory('{"a":1}')).toEqual([]);
  });

  it("drops entries without a heart rate and round-trips valid ones", () => {
    const good = reading(0, 70);
    const raw = JSON.stringify([good, { id: "x", takenAt: NOW }, "junk"]);
    expect(parseHistory(raw)).toEqual([good]);
  });
});

describe("filterByRange", () => {
  const list = [reading(0, 70), reading(6, 66), reading(20, 62), reading(45, 58)];
  it("7 days keeps only the last week", () => expect(filterByRange(list, "7d", NOW)).toHaveLength(2));
  it("30 days keeps the last month", () => expect(filterByRange(list, "30d", NOW)).toHaveLength(3));
  it("all keeps everything", () => expect(filterByRange(list, "all", NOW)).toHaveLength(4));
});

describe("summarize", () => {
  it("gives latest, average, range and change vs earlier readings", () => {
    const s = summarize([reading(0, 80), reading(1, 60), reading(2, 70)], "heartRate");
    expect(s).toEqual({ count: 3, latest: 80, average: 70, min: 60, max: 80, changeVsEarlier: 15 });
  });

  it("ignores readings missing the metric", () => {
    const s = summarize([reading(0, 70, 12, null), reading(1, 70, 14, 30)], "rmssd");
    expect(s?.count).toBe(1);
    expect(s?.changeVsEarlier).toBeNull();
  });

  it("returns null when no reading has the metric", () => {
    expect(summarize([reading(0, 70, null)], "breathingRate")).toBeNull();
  });
});

describe("series", () => {
  it("orders chart points oldest first", () => {
    expect(series([reading(0, 80), reading(2, 60)], "heartRate").map((p) => p.value)).toEqual([60, 80]);
  });
});
