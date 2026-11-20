import type { RefObject } from "react";
import { Camera, Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MEASURE_SECONDS, SKIN_REGIONS, type Conditions, type Phase } from "@/hooks/use-vitals-session";

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  phase: Phase;
  elapsed: number;
  locked: boolean;
  conditions: Conditions;
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
};

function statusText(phase: Phase, locked: boolean, c: Conditions, elapsed: number) {
  if (phase === "starting") return "Opening camera…";
  if (c.light === "dark") return "Too dark — face a window or lamp";
  if (c.light === "bright") return "Too bright — step out of direct light";
  if (c.moving) return "Hold still for a moment";
  if (!locked) return elapsed < 6 ? "Finding your pulse…" : "Keep your face inside the oval";
  return "Pulse locked — keep still";
}

export function CameraStage({ videoRef, stageRef, phase, elapsed, locked, conditions, error, onStart, onCancel }: Props) {
  const live = phase === "measuring" || phase === "starting";
  const progress = Math.min(1, elapsed / MEASURE_SECONDS);
  const warn = live && (conditions.light !== "ok" || conditions.moving);

  return (
    <div className="panel relative overflow-hidden p-2">
      <div ref={stageRef} className="stage-bg relative aspect-[4/5] w-full overflow-hidden rounded-xl">
        <video
          ref={videoRef}
          playsInline
          muted
          className={cn(
            "absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-500",
            live ? "opacity-100" : "opacity-0",
          )}
        />

        {/* Scrim with face-shaped cut-out */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <mask id="oval-cut">
              <rect width="100" height="100" fill="white" />
              <ellipse cx="50" cy="46" rx="30" ry="34" fill="black" />
            </mask>
          </defs>
          <rect width="100" height="100" className="fill-scrim" mask="url(#oval-cut)" />
          <ellipse
            cx="50" cy="46" rx="30" ry="34"
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeWidth={2}
            strokeDasharray={live && !locked ? "6 6" : undefined}
            className={cn(
              "transition-colors duration-500",
              warn ? "stroke-warn" : locked ? "stroke-signal" : "stroke-foreground/40",
            )}
          />
        </svg>

        {/* Skin sampling regions */}
        {live &&
          SKIN_REGIONS.map((r, i) => (
            <div
              key={i}
              className={cn(
                "pointer-events-none absolute rounded-md border transition-colors duration-500",
                locked ? "border-signal/70 bg-signal/10" : "border-foreground/25",
              )}
              style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }}
            />
          ))}

        {live && locked && (
          <div className="pointer-events-none absolute inset-x-[20%] top-[12%] h-[68%] overflow-hidden rounded-[50%]">
            <div className="animate-scan h-1/3 w-full bg-gradient-to-b from-transparent via-signal/15 to-transparent" />
          </div>
        )}

        {/* Idle / error / done overlay */}
        {!live && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-8 text-center">
            <div className="animate-breathe flex size-16 items-center justify-center rounded-full border border-signal/40 bg-signal/10 text-signal">
              <ScanFace className="size-8" strokeWidth={1.5} />
            </div>
            {error ? (
              <p className="max-w-[15rem] text-sm text-destructive">{error}</p>
            ) : (
              <p className="max-w-[14rem] text-sm text-muted-foreground">
                {phase === "done"
                  ? "Measurement complete. Your readings are on the right."
                  : "Sit facing even light, keep still, and fit your face inside the oval."}
              </p>
            )}
            <Button variant="signal" size="xl" onClick={onStart}>
              <Camera />
              {phase === "done" ? "Measure again" : error ? "Try again" : "Start measurement"}
            </Button>
          </div>
        )}

        {/* Live status bar */}
        {live && (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-3 rounded-full border border-border bg-scrim px-4 py-2 backdrop-blur-md">
            <span className={cn("flex items-center gap-2 text-sm", warn ? "text-warn" : locked ? "text-signal" : "text-foreground")}>
              {phase === "starting" || (!locked && !warn) ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <span className={cn("size-2 rounded-full", warn ? "bg-warn" : "bg-signal")} />
              )}
              {statusText(phase, locked, conditions, elapsed)}
            </span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-xs text-muted-foreground tabular">
                {Math.max(0, Math.ceil(MEASURE_SECONDS - elapsed))}s
              </span>
              <button onClick={onCancel} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                Stop
              </button>
            </span>
          </div>
        )}

        {live && (
          <div className="absolute inset-x-0 top-0 h-1 bg-foreground/10">
            <div className="h-full bg-signal transition-[width] duration-300 ease-linear" style={{ width: `${progress * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
