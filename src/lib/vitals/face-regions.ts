/**
 * Face-tracked skin regions. Pure geometry on face-mesh landmarks (468-point MediaPipe topology,
 * coordinates normalised 0–1 to the camera frame) — no browser APIs.
 */

export type Pt = { x: number; y: number };
/** Rectangle normalised to the camera frame (or to the on-screen stage, where noted). */
export type Box = { x: number; y: number; w: number; h: number };

/** Mid/upper forehead, kept above the eyebrows and below the hairline. */
export const FOREHEAD = [108, 151, 337, 69, 299] as const;
/** Fleshy part of each cheek, below the eye and beside the nose. */
export const CHEEK_A = [50, 101, 118, 117, 123, 187, 205] as const;
export const CHEEK_B = [280, 330, 347, 346, 352, 411, 425] as const;

const NOSE_TIP = 1;
const FACE_TOP = 10;
const CHIN = 152;
const EDGE_A = 234;
const EDGE_B = 454;

/** Face narrower than this fraction of the frame is too far away for a clean signal. */
export const MIN_FACE_WIDTH = 0.2;
/** Nose offset from the face centre (as a fraction of face width) beyond which the head counts as turned. */
export const MAX_YAW = 0.12;

/** Bounding box of the given landmarks, shrunk toward its centre by `shrink` (0–1) on each axis. */
export function boxFromPoints(lm: readonly Pt[], idx: readonly number[], shrink = 0): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const i of idx) {
    const p = lm[i];
    if (!p) return null;
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const w = (x1 - x0) * (1 - shrink);
  const h = (y1 - y0) * (1 - shrink);
  return { x: (x0 + x1) / 2 - w / 2, y: (y0 + y1) / 2 - h / 2, w, h };
}

/** Forehead + both cheeks, or null if the landmark set is incomplete. */
export function skinRegions(lm: readonly Pt[]): [Box, Box, Box] | null {
  const f = boxFromPoints(lm, FOREHEAD, 0.1);
  const a = boxFromPoints(lm, CHEEK_A, 0.15);
  const b = boxFromPoints(lm, CHEEK_B, 0.15);
  return f && a && b ? [f, a, b] : null;
}

export type FacePose = { width: number; yaw: number; center: Pt };

export function facePose(lm: readonly Pt[]): FacePose | null {
  const nose = lm[NOSE_TIP], top = lm[FACE_TOP], chin = lm[CHIN], ea = lm[EDGE_A], eb = lm[EDGE_B];
  if (!nose || !top || !chin || !ea || !eb) return null;
  const width = Math.abs(eb.x - ea.x);
  const midX = (ea.x + eb.x) / 2;
  return {
    width,
    yaw: width > 0 ? (nose.x - midX) / width : 0,
    center: { x: midX, y: (top.y + chin.y) / 2 },
  };
}

export type FaceStatus = "ok" | "missing" | "far" | "turned";

export function faceStatus(pose: FacePose | null): FaceStatus {
  if (!pose) return "missing";
  if (pose.width < MIN_FACE_WIDTH) return "far";
  if (Math.abs(pose.yaw) > MAX_YAW) return "turned";
  return "ok";
}

/** Exponential smoothing so regions don't jitter frame to frame (jitter adds noise to the pulse). */
export function smoothBox(prev: Box | null, next: Box, alpha = 0.35): Box {
  if (!prev) return next;
  const k = (a: number, b: number) => a + (b - a) * alpha;
  return { x: k(prev.x, next.x), y: k(prev.y, next.y), w: k(prev.w, next.w), h: k(prev.h, next.h) };
}

export type Dims = { videoW: number; videoH: number; stageW: number; stageH: number };

/** The part of the camera frame visible on a stage that uses object-fit: cover, as frame fractions. */
function visibleWindow({ videoW, videoH, stageW, stageH }: Dims) {
  const scale = Math.max(stageW / videoW, stageH / videoH);
  const w = stageW / scale / videoW;
  const h = stageH / scale / videoH;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** Camera-frame box → on-screen stage fractions (the preview is mirrored like a selfie). */
export function frameToStage(box: Box, dims: Dims, mirror = true): Box {
  const v = visibleWindow(dims);
  const x = (box.x - v.x) / v.w;
  const w = box.w / v.w;
  return { x: mirror ? 1 - x - w : x, y: (box.y - v.y) / v.h, w, h: box.h / v.h };
}

/** On-screen stage fractions → camera-frame box. Inverse of frameToStage. */
export function stageToFrame(box: Box, dims: Dims, mirror = true): Box {
  const v = visibleWindow(dims);
  const sx = mirror ? 1 - box.x - box.w : box.x;
  return { x: v.x + sx * v.w, y: v.y + box.y * v.h, w: box.w * v.w, h: box.h * v.h };
}
