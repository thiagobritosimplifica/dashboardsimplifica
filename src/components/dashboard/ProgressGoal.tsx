import { formatBRL } from "@/lib/dashboard-data";

interface Props {
  label: string;
  value: number;
  goal: number;
  accent?: "blue" | "cyan";
}

export function ProgressGoal({ label, value, goal, accent = "blue" }: Props) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const fill =
    accent === "cyan"
      ? "linear-gradient(90deg, oklch(0.5 0.18 240), oklch(0.85 0.16 210))"
      : "linear-gradient(90deg, oklch(0.4 0.18 262), oklch(0.72 0.18 245))";

  // 5 markers at 20% intervals
  const markers = [20, 40, 60, 80];

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-display">{label}</span>
        <span className="text-sm font-semibold">
          <span className="text-foreground">{formatBRL(value)}</span>
          <span className="text-muted-foreground"> / {formatBRL(goal)}</span>
          <span className="ml-3 text-cyan font-display">{pct.toFixed(0)}%</span>
        </span>
      </div>
      <div className="relative h-4 rounded-full bg-secondary/60 border border-border overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: fill,
            boxShadow: "0 0 18px oklch(0.62 0.2 250 / 0.55)",
          }}
        />
        {markers.map((m) => (
          <span
            key={m}
            className="absolute top-0 h-full w-px bg-background/40"
            style={{ left: `${m}%` }}
          />
        ))}
      </div>
    </div>
  );
}
