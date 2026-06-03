import { formatBRL } from "@/lib/dashboard-data";

interface Props {
  label: string;
  value: number;
  goal: number;
  size?: number;
}

export function Gauge({ label, value, goal, size = 120 }: Props) {
  // Guard against a zero/empty goal (avoids NaN%).
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct / 100);
  const gradId = `grad-${label.replace(/\s+/g, "")}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="oklch(0.5 0.2 262)" />
              <stop offset="100%" stopColor="oklch(0.82 0.15 215)" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="oklch(0.28 0.06 258)"
            strokeWidth={stroke}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gradId})`}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{
              transition: "stroke-dashoffset 800ms ease-out",
              filter: "drop-shadow(0 0 6px oklch(0.62 0.2 250 / 0.6))",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-bold text-gradient-blue">
            {pct.toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-display">{label}</div>
        <div className="text-sm font-semibold mt-0.5">{formatBRL(value)}</div>
      </div>
    </div>
  );
}
