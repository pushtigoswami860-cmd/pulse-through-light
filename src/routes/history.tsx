import { useMemo, useState } from "react";
import { Link, createFileRoute, useHydrated } from "@tanstack/react-router";
import { Activity, HeartPulse, Lock, Trash2, Wind, type LucideIcon } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { TrendChart } from "@/components/history/TrendChart";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { historyActions, useHistory } from "@/hooks/use-history";
import { filterByRange, series, summarize, type Metric, type Range, type Reading } from "@/lib/history/history";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/history")({
  head: () => ({
    meta: [
      { title: "History & trends — veyra" },
      {
        name: "description",
        content: "Your saved heart rate, breathing rate and HRV readings over time, stored privately in this browser.",
      },
      { property: "og:title", content: "History & trends — veyra" },
      {
        property: "og:description",
        content: "See how your heart rate, breathing and HRV change over days and weeks. Kept only on your device.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

const RANGES: { id: Range; label: string }[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "all", label: "All" },
];

const METRICS: {
  id: Metric;
  label: string;
  unit: string;
  icon: LucideIcon;
  color: string;
  text: string;
  chip: string;
}[] = [
  { id: "heartRate", label: "Heart rate", unit: "bpm", icon: HeartPulse, color: "var(--heart)", text: "text-heart", chip: "bg-heart/12 border-heart/30" },
  { id: "breathingRate", label: "Breathing", unit: "/min", icon: Wind, color: "var(--breath)", text: "text-breath", chip: "bg-breath/12 border-breath/30" },
  { id: "rmssd", label: "HRV", unit: "ms", icon: Activity, color: "var(--hrv)", text: "text-hrv", chip: "bg-hrv/12 border-hrv/30" },
];

const r0 = (v: number) => Math.round(v);
const fmtWhen = (t: number) =>
  new Date(t).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function HistoryPage() {
  const hydrated = useHydrated();
  const readings = useHistory();
  const [range, setRange] = useState<Range>("30d");
  const inRange = useMemo(() => (hydrated ? filterByRange(readings, range, Date.now()) : []), [readings, range, hydrated]);

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-10 sm:px-8">
      <SiteHeader />

      <section className="flex flex-col gap-5 pb-8 pt-4 sm:flex-row sm:items-end sm:justify-between sm:pt-8">
        <div>
          <h1 className="font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            Your <em className="text-signal">trends.</em>
          </h1>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="size-3.5 text-signal" />
            Saved only in this browser. Nothing is uploaded or shared.
          </p>
        </div>
        {hydrated && readings.length > 0 && (
          <div role="group" aria-label="Time range" className="flex self-start rounded-full border border-border p-1 sm:self-auto">
            {RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm transition-colors",
                  range === r.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
      </section>

      <main className="flex flex-1 flex-col gap-5">
        {!hydrated ? (
          <div className="grid gap-5 lg:grid-cols-3">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
          </div>
        ) : readings.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-3">
              {METRICS.map((m) => (
                <TrendPanel key={m.id} metric={m} readings={inRange} />
              ))}
            </div>
            <ReadingList readings={inRange} total={readings.length} />
          </>
        )}
      </main>

      <footer className="mt-10 border-t border-border pt-5 text-xs text-muted-foreground">
        For wellness and curiosity only — veyra is not a medical device and does not diagnose any condition.
      </footer>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="panel flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-signal/30 bg-signal/12 text-signal">
        <HeartPulse className="size-5" />
      </span>
      <div>
        <h2 className="font-display text-3xl">No readings yet</h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Every measurement you finish is saved here automatically, so you can see how your numbers change over time.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Take your first reading</Link>
      </Button>
    </div>
  );
}

function TrendPanel({ metric: m, readings }: { metric: (typeof METRICS)[number]; readings: Reading[] }) {
  const summary = summarize(readings, m.id);
  const data = series(readings, m.id);
  const Icon = m.icon;
  const change = summary?.changeVsEarlier ?? null;

  return (
    <section className="panel flex flex-col gap-4 p-5" aria-label={`${m.label} trend`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{m.label}</span>
        <span className={cn("flex size-9 items-center justify-center rounded-full border", m.chip, m.text)}>
          <Icon className="size-4" />
        </span>
      </div>

      {summary ? (
        <>
          <div>
            <div className="flex items-baseline gap-2">
              <span className={cn("font-mono text-5xl font-medium leading-none tabular", m.text)}>{r0(summary.latest)}</span>
              <span className="text-sm text-muted-foreground">{m.unit} latest</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {change === null
                ? "Take another reading to see a change"
                : `${change > 0 ? "+" : change < 0 ? "−" : "±"}${Math.abs(r0(change))} ${m.unit} vs your earlier average`}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-2 border-y border-border py-3 text-xs">
            <div>
              <dt className="text-muted-foreground">Average</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{r0(summary.average)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Range</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{r0(summary.min)}–{r0(summary.max)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Readings</dt>
              <dd className="mt-0.5 font-mono text-sm text-foreground">{summary.count}</dd>
            </div>
          </dl>
          <TrendChart data={data} color={m.color} unit={m.unit} label={m.label} />
        </>
      ) : (
        <p className="flex h-full min-h-40 items-center justify-center text-center text-sm text-muted-foreground">
          {readings.length === 0 ? "No readings in this period." : `No ${m.label.toLowerCase()} readings in this period yet.`}
        </p>
      )}
    </section>
  );
}

function ReadingList({ readings, total }: { readings: Reading[]; total: number }) {
  return (
    <section className="panel p-5" aria-label="Saved readings">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Saved readings</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Showing {readings.length} of {total}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Trash2 className="size-3.5" />
              Clear history
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete all saved readings?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes all {total} readings from this browser. It can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep them</AlertDialogCancel>
              <AlertDialogAction
                onClick={historyActions.clear}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete all
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {readings.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No readings in this period.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {readings.map((r) => (
            <li key={r.id} className="flex items-center gap-4 py-3">
              <span className="min-w-0 flex-1 truncate text-sm">{fmtWhen(r.takenAt)}</span>
              <span className="w-16 text-right font-mono text-sm text-heart tabular">
                {r0(r.heartRate)}<span className="ml-1 text-xs text-muted-foreground">bpm</span>
              </span>
              <span className="hidden w-16 text-right font-mono text-sm text-breath tabular sm:block">
                {r.breathingRate === null ? "--" : r0(r.breathingRate)}<span className="ml-1 text-xs text-muted-foreground">/min</span>
              </span>
              <span className="hidden w-16 text-right font-mono text-sm text-hrv tabular sm:block">
                {r.rmssd === null ? "--" : r0(r.rmssd)}<span className="ml-1 text-xs text-muted-foreground">ms</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-destructive"
                aria-label={`Delete reading from ${fmtWhen(r.takenAt)}`}
                onClick={() => historyActions.remove(r.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
