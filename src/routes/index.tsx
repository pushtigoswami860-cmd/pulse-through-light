import { useEffect, useMemo, type CSSProperties } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Activity, Check, HeartPulse, Sun, Timer, Wind } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { CameraStage } from "@/components/vitals/CameraStage";
import { MetricCard } from "@/components/vitals/MetricCard";
import { PulseWaveform } from "@/components/vitals/PulseWaveform";
import { SignalMeter } from "@/components/vitals/SignalMeter";
import { MEASURE_SECONDS, useVitalsSession } from "@/hooks/use-vitals-session";
import { MIN_SECONDS } from "@/lib/vitals/estimate";
import { historyActions } from "@/hooks/use-history";
import { makeReading } from "@/lib/history/history";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "veyra — Heart rate, breathing & HRV from your camera" },
      {
        name: "description",
        content: "Measure heart rate, breathing rate and HRV in 45 seconds using your front camera. Runs in your browser — no video leaves your device.",
      },
      { property: "og:title", content: "veyra — Contactless vitals from your camera" },
      {
        property: "og:description",
        content: "Heart rate, breathing rate and HRV read from the light on your skin, live in the browser.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function hint(seconds: number, need: number, live: boolean, ready: string) {
  if (!live) return ready;
  return seconds < need ? `Reading in ${Math.ceil(need - seconds)}s…` : ready;
}

function Index() {
  const s = useVitalsSession();
  const live = s.phase === "measuring" || s.phase === "starting";
  const showing = live || s.phase === "done";
  const est = showing ? s.estimate : null;
  const secs = est?.seconds ?? 0;
  const hr = est?.heartRate ?? null;
  const locked = live && hr !== null;

  // Save each completed measurement to the private in-browser history.
  const finished = s.phase === "done" ? s.estimate : null;
  const reading = useMemo(
    () => (finished && s.completedAt ? makeReading(finished, s.completedAt) : null),
    [finished, s.completedAt],
  );
  useEffect(() => {
    if (reading) historyActions.add(reading);
  }, [reading]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-10 sm:px-8">
      <SiteHeader />

      <section className="pb-8 pt-4 sm:pt-8">
        <h1 className="max-w-2xl font-display text-5xl leading-[1.02] tracking-tight sm:text-7xl">
          Your pulse, <em className="text-signal">read by light.</em>
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Every heartbeat tints your skin ever so slightly. Look into your camera for {MEASURE_SECONDS} seconds and
          veyra turns that colour change into heart rate, breathing and HRV.
        </p>
      </section>

      <main className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col gap-4">
          <CameraStage
            videoRef={s.videoRef}
            stageRef={s.stageRef}
            phase={s.phase}
            elapsed={s.elapsed}
            locked={locked}
            conditions={s.conditions}
            error={s.error}
            onStart={s.start}
            onCancel={s.cancel}
          />
          <ul className="grid grid-cols-3 gap-3 text-xs text-muted-foreground">
            <li className="flex items-center gap-2"><Sun className="size-4 text-hrv" />Even, front light</li>
            <li className="flex items-center gap-2"><Activity className="size-4 text-signal" />Keep still</li>
            <li className="flex items-center gap-2"><Timer className="size-4 text-breath" />{MEASURE_SECONDS} seconds</li>
          </ul>
        </div>

        <div className="flex flex-col gap-5">
          <MetricCard
            label="Heart rate"
            value={hr}
            unit="bpm"
            tone="heart"
            size="lg"
            icon={HeartPulse}
            iconClassName={hr ? "animate-heartbeat" : undefined}
            iconStyle={hr ? ({ "--beat": `${60 / hr}s` } as CSSProperties) : undefined}
            hint={hint(secs, MIN_SECONDS.heart, live, s.phase === "done" ? "Average over the last few seconds" : "Live beats per minute")}
          />
          <div className="grid grid-cols-2 gap-5">
            <MetricCard
              label="Breathing"
              value={est?.breathingRate ?? null}
              unit="/min"
              tone="breath"
              icon={Wind}
              hint={hint(secs, MIN_SECONDS.breath, live, "Breaths per minute")}
            />
            <MetricCard
              label="HRV"
              value={est?.rmssd ?? null}
              unit="ms"
              tone="hrv"
              icon={Activity}
              hint={hint(secs, MIN_SECONDS.hrv, live, "RMSSD between beats")}
            />
          </div>

          <div className="panel flex flex-col gap-3 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Pulse wave</span>
              <SignalMeter confidence={est?.confidence ?? 0} active={live && secs >= MIN_SECONDS.heart} />
            </div>
            <div className="h-28">
              <PulseWaveform waveform={est?.waveform ?? []} beats={est?.beats ?? []} />
            </div>
          </div>

          {s.phase === "done" && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground" role="status">
              {reading ? (
                <>
                  <Check className="size-4 text-signal" />
                  Saved to your history on this device.
                  <Link to="/history" className="text-signal underline-offset-4 hover:underline">
                    See your trends
                  </Link>
                </>
              ) : (
                "No clear pulse this time, so this reading wasn't saved. Try brighter, even light and keep still."
              )}
            </p>
          )}
        </div>
      </main>

      <footer className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">
        For wellness and curiosity only — veyra is not a medical device and does not diagnose any condition.
      </footer>
    </div>
  );
}
