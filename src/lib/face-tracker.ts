import type { FaceLandmarker } from "@mediapipe/tasks-vision";

/**
 * On-device face landmark tracking. The model and runtime are downloaded once; camera frames are
 * processed locally and never leave the browser. Call only from the browser (effects / handlers).
 */
const TASKS_VERSION = "1.2.3"; // keep in sync with @mediapipe/tasks-vision in package.json
const WASM_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let pending: Promise<FaceLandmarker> | null = null;

export function loadFaceTracker(): Promise<FaceLandmarker> {
  if (!pending) {
    pending = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
      const create = (delegate: "GPU" | "CPU") =>
        FaceLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          runningMode: "VIDEO",
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
      try {
        return await create("GPU");
      } catch {
        return await create("CPU");
      }
    })().catch((e: unknown) => {
      pending = null; // allow a retry on the next measurement
      throw e;
    });
  }
  return pending;
}
