import { describe, expect, it } from "vitest";
import { hrvFromBeats, type RgbSample } from "./dsp";
import { estimateVitals } from "./estimate";

// Deterministic noise so tests never flake.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296 - 0.5;
  };
}

function synth(seconds: number, hrHz: number, rrHz: number): RgbSample[] {
  const noise = rng(42);
  const out: RgbSample[] = [];
  for (let i = 0; i < seconds * 30; i++) {
    const t = i * 33.3 + noise() * 6; // ~30 fps with jitter
    const s = t / 1000;
    const pulse = Math.sin(2 * Math.PI * hrHz * s);
    const breath = 1 + 0.01 * Math.sin(2 * Math.PI * rrHz * s);
    out.push({
      t,
      r: (150 + 0.3 * pulse + noise() * 0.2) * breath,
      g: (120 + 0.8 * pulse + noise() * 0.2) * breath,
      b: (100 + 0.2 * pulse + noise() * 0.2) * breath,
    });
  }
  return out;
}

describe("estimateVitals", () => {
  it("reads a 72 bpm pulse as about 72 beats per minute", () => {
    const v = estimateVitals(synth(20, 1.2, 0.25));
    expect(v.heartRate).not.toBeNull();
    expect(v.heartRate!).toBeGreaterThan(70);
    expect(v.heartRate!).toBeLessThan(74);
  });

  it("reads a 15 breaths/min rhythm as about 15 breaths per minute", () => {
    const v = estimateVitals(synth(40, 1.2, 0.25));
    expect(v.breathingRate).not.toBeNull();
    expect(v.breathingRate!).toBeGreaterThan(13.5);
    expect(v.breathingRate!).toBeLessThan(16.5);
  });

  it("gives no reading before 6 seconds of signal", () => {
    const v = estimateVitals(synth(4, 1.2, 0.25));
    expect(v.heartRate).toBeNull();
  });

  it("gives no breathing reading before 15 seconds of signal", () => {
    const v = estimateVitals(synth(12, 1.2, 0.25));
    expect(v.breathingRate).toBeNull();
  });
});

describe("hrvFromBeats", () => {
  const beatsFrom = (ibisMs: number[]) => {
    const t = [0];
    for (const ibi of ibisMs) t.push(t[t.length - 1]! + ibi / 1000);
    return t;
  };

  it("alternating 800/820 ms beats give an RMSSD of 20 ms", () => {
    const hrv = hrvFromBeats(beatsFrom([800, 820, 800, 820, 800, 820, 800, 820]));
    expect(hrv!.rmssd).toBeCloseTo(20, 5);
  });

  it("drops a missed-beat artefact more than 25% off the median", () => {
    const hrv = hrvFromBeats(beatsFrom([800, 820, 800, 1600, 800, 820, 800, 820, 800]));
    expect(hrv!.rmssd).toBeCloseTo(20, 5);
  });

  it("needs at least 5 intervals", () => {
    expect(hrvFromBeats(beatsFrom([800, 820, 800, 820]))).toBeNull();
  });
});
