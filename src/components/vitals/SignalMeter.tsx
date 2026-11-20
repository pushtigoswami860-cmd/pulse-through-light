import { cn } from "@/lib/utils";

export function SignalMeter({ confidence, active }: { confidence: number; active: boolean }) {
  const bars = 5;
  const lit = active ? Math.round(confidence * bars) : 0;
  const label = !active ? "Waiting" : lit >= 4 ? "Strong" : lit >= 2 ? "Fair" : "Weak";
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-end gap-1" aria-hidden>
        {Array.from({ length: bars }, (_, i) => (
          <span
            key={i}
            className={cn("w-1.5 rounded-full transition-colors duration-300", i < lit ? "bg-signal" : "bg-foreground/15")}
            style={{ height: `${8 + i * 4}px` }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">
        Signal <span className="text-foreground">{label}</span>
      </span>
    </div>
  );
}
