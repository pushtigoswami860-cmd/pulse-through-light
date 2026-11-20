import {
  HR_BAND,
  RR_BAND,
  bandpass,
  detectPeaks,
  dominantFrequency,
  hrvFromBeats,
  posPulse,
  resample,
  type RgbSample,
} from "./dsp";

export const SAMPLE_RATE = 30;
/** Seconds of signal before each reading is attempted. */
export const MIN_SECONDS = { heart: 6, hrv: 15, breath: 15 } as const;
/** Readings below this confidence are hidden as unreliable. */
export const MIN_HR_CONFIDENCE = 0.25;

export type VitalsEstimate = {
  heartRate: number | null; // beats per minute
  breathingRate: number | null; // breaths per minute
  rmssd: number | null; // ms
  sdnn: number | null; // ms
  confidence: number; // 0–1 quality of the pulse signal
  waveform: number[]; // last few seconds of the filtered pulse, normalised to -1..1
  beats: number[]; // beat times (seconds from the end of the window, negative) inside the waveform
  seconds: number; // length of usable signal
};

const lastSeconds = (samples: RgbSample[], seconds: number) => {
  const end = samples[samples.length - 1]?.t ?? 0;
  return samples.filter((s) => s.t >= end - seconds * 1000);
};

export function estimateVitals(samples: RgbSample[], waveformSeconds = 8): VitalsEstimate {
  const fs = SAMPLE_RATE;
  const seconds = samples.length > 1 ? (samples[samples.length - 1]!.t - samples[0]!.t) / 1000 : 0;
  const empty: VitalsEstimate = {
    heartRate: null, breathingRate: null, rmssd: null, sdnn: null,
    confidence: 0, waveform: [], beats: [], seconds,
  };
  if (seconds < MIN_SECONDS.heart) return empty;

  // Heart rate from the most recent 12 s for responsiveness.
  const recent = resample(lastSeconds(samples, 12), fs);
  const recentPulse = posPulse(recent, fs);
  const hr = dominantFrequency(recentPulse, fs, HR_BAND);
  const confidence = hr ? Math.min(1, hr.confidence / 0.6) : 0;
  const hrOk = hr !== null && hr.confidence >= MIN_HR_CONFIDENCE;

  // Longer window for HRV and the waveform.
  const long = resample(lastSeconds(samples, 60), fs);
  const longPulse = posPulse(long, fs);
  const f = hr?.freq ?? 1.2;
  const lo = Math.max(HR_BAND.min, f - 0.6);
  const hi = Math.min(HR_BAND.max, f + 0.6);
  const filtered = bandpass(longPulse, fs, lo, hi);
  const peaks = detectPeaks(filtered, fs, 0.6 / f);

  let rmssd: number | null = null;
  let sdnn: number | null = null;
  if (hrOk && seconds >= MIN_SECONDS.hrv) {
    const hrv = hrvFromBeats(peaks);
    if (hrv) { rmssd = hrv.rmssd; sdnn = hrv.sdnn; }
  }

  // Breathing from the shared intensity (luminance) signal, which rises and falls with each breath.
  let breathingRate: number | null = null;
  if (seconds >= MIN_SECONDS.breath) {
    const lum = new Float64Array(long.g.length);
    for (let i = 0; i < lum.length; i++) lum[i] = (long.r[i]! + long.g[i]! + long.b[i]!) / 3;
    const rr = dominantFrequency(lum, fs, RR_BAND);
    if (rr && rr.confidence > 0.2) breathingRate = rr.freq * 60;
  }

  const wfLen = Math.min(filtered.length, Math.round(waveformSeconds * fs));
  const tail = filtered.slice(filtered.length - wfLen);
  let peakAbs = 0;
  for (const v of tail) peakAbs = Math.max(peakAbs, Math.abs(v));
  const waveform = Array.from(tail, (v) => (peakAbs > 0 ? v / peakAbs : 0));
  const total = filtered.length / fs;
  const beats = peaks.map((t) => t - total).filter((t) => t >= -waveformSeconds);

  return {
    heartRate: hrOk ? hr!.freq * 60 : null,
    breathingRate,
    rmssd,
    sdnn,
    confidence,
    waveform,
    beats,
    seconds,
  };
}
