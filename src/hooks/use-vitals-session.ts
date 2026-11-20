import { useCallback, useEffect, useRef, useState } from "react";
import type { RgbSample } from "@/lib/vitals/dsp";
import { estimateVitals, type VitalsEstimate } from "@/lib/vitals/estimate";

export const MEASURE_SECONDS = 45;

export type Phase = "idle" | "starting" | "measuring" | "done" | "error";
export type Conditions = { light: "ok" | "dark" | "bright"; moving: boolean };

/** Skin regions as fractions of the camera stage (forehead + both cheeks inside the guide oval). */
export const SKIN_REGIONS = [
  { x: 0.38, y: 0.19, w: 0.24, h: 0.1 },
  { x: 0.28, y: 0.44, w: 0.13, h: 0.11 },
  { x: 0.59, y: 0.44, w: 0.13, h: 0.11 },
] as const;

const SAMPLE_PX = 24;

type FrameStats = { r: number; g: number; b: number; lum: number; gray: Float32Array };

function readRegions(video: HTMLVideoElement, stage: HTMLElement, ctx: CanvasRenderingContext2D): FrameStats | null {
  const vw = video.videoWidth, vh = video.videoHeight;
  const cw = stage.clientWidth, ch = stage.clientHeight;
  if (!vw || !vh || !cw || !ch) return null;
  // Map stage fractions to video pixels, accounting for object-fit: cover cropping.
  const scale = Math.max(cw / vw, ch / vh);
  const visW = cw / scale, visH = ch / scale;
  const offX = (vw - visW) / 2, offY = (vh - visH) / 2;
  let r = 0, g = 0, b = 0, n = 0;
  const gray = new Float32Array(SAMPLE_PX * SAMPLE_PX);
  SKIN_REGIONS.forEach((reg, idx) => {
    ctx.drawImage(video, offX + reg.x * visW, offY + reg.y * visH, reg.w * visW, reg.h * visH, 0, 0, SAMPLE_PX, SAMPLE_PX);
    const data = ctx.getImageData(0, 0, SAMPLE_PX, SAMPLE_PX).data;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      r += data[i]!; g += data[i + 1]!; b += data[i + 2]!; n++;
      if (idx === 0) gray[p] = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
    }
  });
  r /= n; g /= n; b /= n;
  return { r, g, b, lum: (r + g + b) / 3, gray };
}

export function useVitalsSession() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const samplesRef = useRef<RgbSample[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const prevGrayRef = useRef<Float32Array | null>(null);
  const motionRef = useRef(0);
  const lumRef = useRef(128);
  const startRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const tickRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const smoothRef = useRef<{ hr: number | null; rr: number | null }>({ hr: null, rr: null });

  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<VitalsEstimate | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [conditions, setConditions] = useState<Conditions>({ light: "ok", moving: false });

  const stopCamera = useCallback(() => {
    runningRef.current = false;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (tickRef.current !== null) window.clearInterval(tickRef.current);
    frameRef.current = null;
    tickRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const sampleFrame = useCallback(() => {
    if (!runningRef.current) return;
    const video = videoRef.current;
    const stage = stageRef.current;
    if (video && stage && video.readyState >= 2) {
      if (!ctxRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = SAMPLE_PX;
        canvas.height = SAMPLE_PX;
        ctxRef.current = canvas.getContext("2d", { willReadFrequently: true });
      }
      const ctx = ctxRef.current;
      const stats = ctx ? readRegions(video, stage, ctx) : null;
      if (stats) {
        samplesRef.current.push({ t: performance.now(), r: stats.r, g: stats.g, b: stats.b });
        const prev = prevGrayRef.current;
        if (prev) {
          let diff = 0;
          for (let i = 0; i < prev.length; i++) diff += Math.abs(prev[i]! - stats.gray[i]!);
          motionRef.current = motionRef.current * 0.85 + (diff / prev.length) * 0.15;
        }
        prevGrayRef.current = stats.gray;
        lumRef.current = stats.lum;
        // Keep at most 70 s of samples.
        const cutoff = performance.now() - 70_000;
        while (samplesRef.current.length && samplesRef.current[0]!.t < cutoff) samplesRef.current.shift();
      }
    }
    frameRef.current = requestAnimationFrame(sampleFrame);
  }, []);

  const smooth = (key: "hr" | "rr", value: number | null) => {
    const prev = smoothRef.current[key];
    const next = value === null ? prev : prev === null ? value : prev * 0.65 + value * 0.35;
    smoothRef.current[key] = next;
    return next;
  };

  const tick = useCallback(() => {
    const secs = (performance.now() - startRef.current) / 1000;
    setElapsed(secs);
    setConditions({
      light: lumRef.current < 50 ? "dark" : lumRef.current > 230 ? "bright" : "ok",
      moving: motionRef.current > 5,
    });
    const est = estimateVitals(samplesRef.current);
    if (secs >= MEASURE_SECONDS) {
      stopCamera();
      setEstimate(est);
      setPhase("done");
      return;
    }
    setEstimate({ ...est, heartRate: smooth("hr", est.heartRate), breathingRate: smooth("rr", est.breathingRate) });
  }, [stopCamera]);

  const start = useCallback(async () => {
    setError(null);
    setEstimate(null);
    setElapsed(0);
    setPhase("starting");
    samplesRef.current = [];
    prevGrayRef.current = null;
    motionRef.current = 0;
    smoothRef.current = { hr: null, rr: null };
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("no-video");
      video.srcObject = stream;
      await video.play();
      runningRef.current = true;
      startRef.current = performance.now();
      setPhase("measuring");
      frameRef.current = requestAnimationFrame(sampleFrame);
      tickRef.current = window.setInterval(tick, 250);
    } catch (e) {
      stopCamera();
      const name = e instanceof DOMException ? e.name : e instanceof Error ? e.message : "";
      setError(
        name === "NotAllowedError"
          ? "Camera access was blocked. Allow the camera in your browser's address bar, then try again."
          : name === "NotFoundError"
            ? "No camera was found on this device."
            : name === "unsupported"
              ? "This browser can't open the camera. Try the latest Chrome, Safari or Firefox."
              : "The camera couldn't start. Close other apps using it and try again.",
      );
      setPhase("error");
    }
  }, [sampleFrame, tick, stopCamera]);

  const cancel = useCallback(() => {
    stopCamera();
    setPhase("idle");
    setEstimate(null);
    setElapsed(0);
  }, [stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  return { videoRef, stageRef, phase, error, estimate, elapsed, conditions, start, cancel };
}
