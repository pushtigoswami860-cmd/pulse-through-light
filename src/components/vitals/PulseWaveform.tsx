import { useEffect, useRef } from "react";

type Props = { waveform: number[]; beats: number[]; seconds?: number };

/** Draws the filtered pulse trace as a phosphor-style line with beat markers. */
export function PulseWaveform({ waveform, beats, seconds = 8 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    const css = getComputedStyle(document.documentElement);
    const signal = css.getPropertyValue("--signal").trim();
    const heart = css.getPropertyValue("--heart").trim();
    const grid = css.getPropertyValue("--border").trim();

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let s = 1; s < seconds; s++) {
      const x = (s / seconds) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    if (waveform.length < 2) return;
    const n = waveform.length;
    const xAt = (i: number) => w - ((n - 1 - i) / (seconds * 30)) * w;
    const yAt = (v: number) => h / 2 - v * (h * 0.38);

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.shadowColor = signal;
    ctx.shadowBlur = 12;
    ctx.strokeStyle = signal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    waveform.forEach((v, i) => (i === 0 ? ctx.moveTo(xAt(i), yAt(v)) : ctx.lineTo(xAt(i), yAt(v))));
    ctx.stroke();

    ctx.shadowBlur = 8;
    ctx.shadowColor = heart;
    ctx.fillStyle = heart;
    for (const t of beats) {
      const idx = Math.round(n - 1 + t * 30);
      const v = waveform[Math.max(0, Math.min(n - 1, idx))] ?? 0;
      ctx.beginPath();
      ctx.arc(w + (t / seconds) * w, yAt(v), 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [waveform, beats, seconds]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-label="Live pulse waveform" />;
}
