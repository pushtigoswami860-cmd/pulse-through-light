/**
 * Pure signal-processing helpers for camera-based (rPPG) vital-sign estimation.
 * Everything here is deterministic and framework-free so it can be unit tested.
 */

export type RgbSample = { t: number; r: number; g: number; b: number }; // t in milliseconds

export type Channels = { r: Float64Array; g: Float64Array; b: Float64Array };

/** Heart-rate search band in Hz (42–180 bpm). */
export const HR_BAND = { min: 0.7, max: 3.0 } as const;
/** Respiratory-rate search band in Hz (6–30 breaths/min). */
export const RR_BAND = { min: 0.1, max: 0.5 } as const;

/** Linearly resample irregular camera samples onto a uniform grid at `fs` Hz. */
export function resample(samples: RgbSample[], fs: number): Channels {
  const empty = { r: new Float64Array(0), g: new Float64Array(0), b: new Float64Array(0) };
  if (samples.length < 2) return empty;
  const first = samples[0]!;
  const last = samples[samples.length - 1]!;
  const n = Math.floor(((last.t - first.t) / 1000) * fs) + 1;
  const r = new Float64Array(n);
  const g = new Float64Array(n);
  const b = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = first.t + (i * 1000) / fs;
    while (j < samples.length - 2 && samples[j + 1]!.t < t) j++;
    const a = samples[j]!;
    const c = samples[j + 1]!;
    const span = c.t - a.t;
    const w = span > 0 ? Math.min(1, Math.max(0, (t - a.t) / span)) : 0;
    r[i] = a.r + (c.r - a.r) * w;
    g[i] = a.g + (c.g - a.g) * w;
    b[i] = a.b + (c.b - a.b) * w;
  }
  return { r, g, b };
}

/** Remove the best-fit straight line from a signal. */
export function detrendLinear(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  const out = new Float64Array(n);
  if (n === 0) return out;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const y = x[i]!;
    sx += i; sy += y; sxx += i * i; sxy += i * y;
  }
  const denom = n * sxx - sx * sx;
  const slope = denom === 0 ? 0 : (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  for (let i = 0; i < n; i++) out[i] = x[i]! - (slope * i + intercept);
  return out;
}

/**
 * Plane-Orthogonal-to-Skin pulse extraction (Wang et al., 2017).
 * Cancels intensity changes shared by all channels (lighting, breathing, small motion).
 */
export function posPulse({ r, g, b }: Channels, fs: number): Float64Array {
  const n = r.length;
  const h = new Float64Array(n);
  const l = Math.max(2, Math.round(1.6 * fs));
  if (n < l) return h;
  const s1 = new Float64Array(l);
  const s2 = new Float64Array(l);
  for (let start = 0; start + l <= n; start++) {
    let mr = 0, mg = 0, mb = 0;
    for (let k = 0; k < l; k++) {
      mr += r[start + k]!; mg += g[start + k]!; mb += b[start + k]!;
    }
    mr = mr / l || 1; mg = mg / l || 1; mb = mb / l || 1;
    let m1 = 0, m2 = 0;
    for (let k = 0; k < l; k++) {
      const cr = r[start + k]! / mr;
      const cg = g[start + k]! / mg;
      const cb = b[start + k]! / mb;
      s1[k] = cg - cb;
      s2[k] = cg + cb - 2 * cr;
      m1 += s1[k]!; m2 += s2[k]!;
    }
    m1 /= l; m2 /= l;
    let v1 = 0, v2 = 0;
    for (let k = 0; k < l; k++) {
      v1 += (s1[k]! - m1) ** 2;
      v2 += (s2[k]! - m2) ** 2;
    }
    const alpha = v2 > 0 ? Math.sqrt(v1 / v2) : 0;
    let mp = 0;
    for (let k = 0; k < l; k++) mp += s1[k]! + alpha * s2[k]!;
    mp /= l;
    for (let k = 0; k < l; k++) h[start + k] = h[start + k]! + (s1[k]! + alpha * s2[k]! - mp);
  }
  return h;
}

/** In-place iterative radix-2 FFT. Length must be a power of two. */
export function fft(re: Float64Array, im: Float64Array, inverse = false): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k]!, ai = im[i + k]!;
        const br = re[i + k + len / 2]!, bi = im[i + k + len / 2]!;
        const tr = br * cr - bi * ci;
        const ti = br * ci + bi * cr;
        re[i + k] = ar + tr; im[i + k] = ai + ti;
        re[i + k + len / 2] = ar - tr; im[i + k + len / 2] = ai - ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] = re[i]! / n; im[i] = im[i]! / n; }
}

export const nextPow2 = (n: number) => 2 ** Math.ceil(Math.log2(Math.max(2, n)));

/** Find the strongest frequency inside `band`, with a 0–1 confidence score. */
export function dominantFrequency(
  x: ArrayLike<number>,
  fs: number,
  band: { min: number; max: number },
): { freq: number; confidence: number } | null {
  const n = x.length;
  if (n < fs * 2) return null;
  const nfft = Math.max(4096, nextPow2(n));
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  const d = detrendLinear(x);
  for (let i = 0; i < n; i++) re[i] = d[i]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  fft(re, im);
  const res = fs / nfft;
  const lo = Math.max(1, Math.ceil(band.min / res));
  const hi = Math.min(nfft / 2 - 1, Math.floor(band.max / res));
  let best = -1, bestP = 0, total = 0;
  const power = (k: number) => re[k]! ** 2 + im[k]! ** 2;
  for (let k = lo; k <= hi; k++) {
    const p = power(k);
    total += p;
    if (p > bestP) { bestP = p; best = k; }
  }
  if (best < 0 || total === 0) return null;
  // Parabolic interpolation around the peak for sub-bin accuracy.
  const a = power(best - 1), c = power(best + 1);
  const denom = a - 2 * bestP + c;
  const shift = denom !== 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (a - c)) / denom)) : 0;
  const freq = (best + shift) * res;
  // Confidence: share of in-band power concentrated within ±0.08 Hz of the peak.
  const halfWidth = Math.max(1, Math.round(0.08 / res));
  let peakP = 0;
  for (let k = Math.max(lo, best - halfWidth); k <= Math.min(hi, best + halfWidth); k++) peakP += power(k);
  return { freq, confidence: peakP / total };
}

/** Zero-phase FFT band-pass filter. */
export function bandpass(x: ArrayLike<number>, fs: number, lo: number, hi: number): Float64Array {
  const n = x.length;
  const nfft = nextPow2(n * 2);
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  const d = detrendLinear(x);
  for (let i = 0; i < n; i++) re[i] = d[i]!;
  fft(re, im);
  for (let k = 0; k < nfft; k++) {
    const f = (Math.min(k, nfft - k) * fs) / nfft;
    if (f < lo || f > hi) { re[k] = 0; im[k] = 0; }
  }
  fft(re, im, true);
  return re.slice(0, n);
}

/** Local maxima at least `minDistSec` apart, with sub-sample (parabolic) timing in seconds. */
export function detectPeaks(x: ArrayLike<number>, fs: number, minDistSec: number): number[] {
  const minDist = Math.max(1, Math.floor(minDistSec * fs));
  const idx: number[] = [];
  for (let i = 1; i < x.length - 1; i++) {
    const v = x[i]!;
    if (v <= 0 || v < x[i - 1]! || v <= x[i + 1]!) continue;
    const prev = idx[idx.length - 1];
    if (prev !== undefined && i - prev < minDist) {
      if (v > x[prev]!) idx[idx.length - 1] = i;
    } else idx.push(i);
  }
  return idx.map((i) => {
    const a = x[i - 1]!, b = x[i]!, c = x[i + 1]!;
    const denom = a - 2 * b + c;
    const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0;
    return (i + shift) / fs;
  });
}

/**
 * Heart-rate variability from beat times (seconds).
 * Intervals more than 25% away from the median are treated as artefacts and dropped.
 * Needs at least 5 clean intervals.
 */
export function hrvFromBeats(beatTimes: number[]): { rmssd: number; sdnn: number; beats: number } | null {
  const ibis: number[] = [];
  for (let i = 1; i < beatTimes.length; i++) ibis.push((beatTimes[i]! - beatTimes[i - 1]!) * 1000);
  if (ibis.length < 5) return null;
  const sorted = [...ibis].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const ok = ibis.map((v) => Math.abs(v - median) <= median * 0.25);
  const clean = ibis.filter((_, i) => ok[i]);
  if (clean.length < 5) return null;
  let sumSq = 0, pairs = 0;
  for (let i = 1; i < ibis.length; i++) {
    if (ok[i] && ok[i - 1]) { sumSq += (ibis[i]! - ibis[i - 1]!) ** 2; pairs++; }
  }
  if (pairs < 4) return null;
  const mean = clean.reduce((s, v) => s + v, 0) / clean.length;
  const sdnn = Math.sqrt(clean.reduce((s, v) => s + (v - mean) ** 2, 0) / clean.length);
  return { rmssd: Math.sqrt(sumSq / pairs), sdnn, beats: clean.length + 1 };
}
