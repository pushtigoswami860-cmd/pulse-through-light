import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";

type Point = { t: number; value: number };
const HALF_DAY = 43_200_000;

const fmtDay = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtFull = (t: number) =>
  new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function TrendChart({ data, color, unit, label }: { data: Point[]; color: string; unit: string; label: string }) {
  const config = { value: { label, color } } satisfies ChartConfig;
  const values = data.map((d) => d.value);
  const lo = Math.min(...values), hi = Math.max(...values);
  const pad = Math.max(2, (hi - lo) * 0.25);
  // Round the axis to steps of 5 so the gridlines land on even numbers.
  const yMin = Math.max(0, Math.floor((lo - pad) / 5) * 5);
  const yMax = Math.ceil((hi + pad) / 5) * 5;
  const step = Math.max(5, Math.ceil((yMax - yMin) / 3 / 5) * 5);
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax; v += step) ticks.push(v);
  const first = data[0]?.t ?? 0;

  return (
    <ChartContainer config={config} className="aspect-auto h-44 w-full">
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="t"
          type="number"
          scale="time"
          domain={data.length > 1 ? ["dataMin", "dataMax"] : [first - HALF_DAY, first + HALF_DAY]}
          tickFormatter={fmtDay}
          tickLine={false}
          axisLine={false}
          minTickGap={28}
        />
        <YAxis
          domain={[yMin, Math.max(yMax, ticks[ticks.length - 1]!)]}
          ticks={ticks}
          tickLine={false}
          axisLine={false}
          width={40}
          allowDecimals={false}
        />
        <ChartTooltip
          cursor={{ strokeDasharray: "3 4" }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as Point | undefined;
            if (!active || !p) return null;
            return (
              <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
                <div className="text-muted-foreground">{fmtFull(p.t)}</div>
                <div className="mt-0.5 font-mono text-sm text-foreground">
                  {Math.round(p.value)} <span className="text-muted-foreground">{unit}</span>
                </div>
              </div>
            );
          }}
        />
        <Line
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
