import { describe, expect, it } from "vitest";
import {
  CHEEK_A,
  CHEEK_B,
  FOREHEAD,
  boxFromPoints,
  facePose,
  faceStatus,
  frameToStage,
  skinRegions,
  smoothBox,
  stageToFrame,
  type Pt,
} from "./face-regions";

/** A frontal synthetic face centred at (cx, cy) with the given width, filling the landmark slots we use. */
function face(cx = 0.5, cy = 0.5, width = 0.4, noseShift = 0): Pt[] {
  const lm: Pt[] = Array.from({ length: 468 }, () => ({ x: cx, y: cy }));
  const half = width / 2;
  lm[234] = { x: cx - half, y: cy };
  lm[454] = { x: cx + half, y: cy };
  lm[10] = { x: cx, y: cy - width * 0.6 };
  lm[152] = { x: cx, y: cy + width * 0.6 };
  lm[1] = { x: cx + noseShift * width, y: cy };
  FOREHEAD.forEach((i, k) => (lm[i] = { x: cx - half * 0.4 + k * half * 0.2, y: cy - width * 0.4 + (k % 2) * 0.03 }));
  CHEEK_A.forEach((i, k) => (lm[i] = { x: cx - half * 0.6 + (k % 3) * 0.02, y: cy + 0.02 + (k % 2) * 0.04 }));
  CHEEK_B.forEach((i, k) => (lm[i] = { x: cx + half * 0.6 - (k % 3) * 0.02, y: cy + 0.02 + (k % 2) * 0.04 }));
  return lm;
}

describe("skin regions", () => {
  it("places the forehead above both cheeks, with cheeks on either side of the nose", () => {
    const r = skinRegions(face())!;
    const [f, a, b] = r;
    expect(f.y + f.h).toBeLessThan(a.y);
    expect(f.y + f.h).toBeLessThan(b.y);
    expect(a.x + a.w).toBeLessThan(0.5);
    expect(b.x).toBeGreaterThan(0.5);
  });

  it("moves with the face", () => {
    const left = skinRegions(face(0.35))!, right = skinRegions(face(0.65))!;
    expect(right[0].x - left[0].x).toBeCloseTo(0.3, 5);
  });

  it("returns null when landmarks are missing", () => {
    expect(skinRegions(face().slice(0, 100))).toBeNull();
  });

  it("shrinks boxes toward their centre", () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    expect(boxFromPoints(pts, [0, 1], 0.5)).toEqual({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 });
  });
});

describe("face status", () => {
  it("accepts a frontal face at a good distance", () => expect(faceStatus(facePose(face()))).toBe("ok"));
  it("asks to come closer when the face is small", () => expect(faceStatus(facePose(face(0.5, 0.5, 0.15)))).toBe("far"));
  it("flags a turned head", () => expect(faceStatus(facePose(face(0.5, 0.5, 0.4, 0.2)))).toBe("turned"));
  it("reports no face", () => expect(faceStatus(null)).toBe("missing"));
});

describe("frame ↔ stage mapping", () => {
  // 640×480 camera shown in a portrait 4:5 stage: the sides of the frame are cropped.
  const dims = { videoW: 640, videoH: 480, stageW: 400, stageH: 500 };

  it("round-trips a box", () => {
    const box = { x: 0.42, y: 0.3, w: 0.1, h: 0.08 };
    const back = stageToFrame(frameToStage(box, dims), dims);
    expect(back.x).toBeCloseTo(box.x, 9);
    expect(back.y).toBeCloseTo(box.y, 9);
    expect(back.w).toBeCloseTo(box.w, 9);
  });

  it("mirrors left and right like a selfie preview", () => {
    const leftInFrame = frameToStage({ x: 0.4, y: 0.4, w: 0.05, h: 0.05 }, dims);
    expect(leftInFrame.x).toBeGreaterThan(0.5);
  });

  it("maps the frame centre to the stage centre", () => {
    const s = frameToStage({ x: 0.5, y: 0.5, w: 0, h: 0 }, dims);
    expect(s.x).toBeCloseTo(0.5, 9);
    expect(s.y).toBeCloseTo(0.5, 9);
  });
});

describe("smoothBox", () => {
  it("moves part-way toward the new position", () => {
    expect(smoothBox({ x: 0, y: 0, w: 1, h: 1 }, { x: 1, y: 1, w: 1, h: 1 }, 0.5)).toEqual({ x: 0.5, y: 0.5, w: 1, h: 1 });
  });
});
