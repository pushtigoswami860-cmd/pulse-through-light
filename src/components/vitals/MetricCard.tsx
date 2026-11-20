import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tones = {
  heart: { text: "text-heart", bg: "bg-heart/12", ring: "border-heart/30" },
  breath: { text: "text-breath", bg: "bg-breath/12", ring: "border-breath/30" },
  hrv: { text: "text-hrv", bg: "bg-hrv/12", ring: "border-hrv/30" },
} as const;

type Props = {
  label: string;
  value: number | null;
  unit: string;
  tone: keyof typeof tones;
  icon: LucideIcon;
  hint: string;
  size?: "lg" | "md";
  iconClassName?: string | undefined;
  iconStyle?: CSSProperties | undefined;
};

export function MetricCard({ label, value, unit, tone, icon: Icon, hint, size = "md", iconClassName, iconStyle }: Props) {
  const t = tones[tone];
  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className={cn("flex size-9 items-center justify-center rounded-full border", t.bg, t.ring, t.text)}>
          <Icon className={cn("size-4", iconClassName)} style={iconStyle} />
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-mono font-medium leading-none tabular transition-colors",
            size === "lg" ? "text-7xl" : "text-5xl",
            value === null ? "text-muted-foreground/40" : t.text,
          )}
        >
          {value === null ? "--" : Math.round(value)}
        </span>
        <span className="text-sm text-muted-foreground">{unit}</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
