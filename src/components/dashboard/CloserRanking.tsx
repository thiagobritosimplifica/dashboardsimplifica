import { Trophy } from "lucide-react";
import type { CloserStats } from "@/lib/dashboard-data";
import { formatBRL } from "@/lib/dashboard-data";

function PodiumItem({
  closer,
  place,
}: {
  closer: CloserStats;
  place: 1 | 2 | 3;
}) {
  const total = closer.vendas.value;
  const initials = closer.name.slice(0, 2).toUpperCase();
  const config = {
    1: { medal: "🥇", h: "h-32", color: "var(--gold)", ring: "oklch(0.85 0.16 90 / 0.6)", scale: "scale-110", size: "h-20 w-20", text: "text-lg" },
    2: { medal: "🥈", h: "h-20", color: "var(--silver)", ring: "oklch(0.82 0.02 250 / 0.5)", scale: "", size: "h-14 w-14", text: "text-sm" },
    3: { medal: "🥉", h: "h-14", color: "var(--bronze)", ring: "oklch(0.65 0.13 55 / 0.5)", scale: "", size: "h-14 w-14", text: "text-sm" },
  }[place];

  return (
    <div className={`flex flex-col items-center gap-2 ${config.scale}`}>
      <div className="text-2xl">{config.medal}</div>
      <div
        className={`${config.size} rounded-full grid place-items-center font-display font-bold`}
        style={{
          background: "var(--gradient-blue)",
          boxShadow: `0 0 18px ${config.ring}`,
          border: `2px solid ${config.color}`,
        }}
      >
        {initials}
      </div>
      <div className="text-center">
        <div className={`font-display font-semibold ${config.text}`}>{closer.name}</div>
        <div className="text-xs text-cyan tabular-nums">{formatBRL(total)}</div>
      </div>
      <div
        className={`w-20 ${config.h} rounded-t-md`}
        style={{
          background: `linear-gradient(180deg, ${config.color}, oklch(0.2 0.05 260))`,
          opacity: 0.85,
        }}
      />
    </div>
  );
}

export function CloserRanking({ closers }: { closers: CloserStats[] }) {
  const sorted = [...closers]
    .sort((a, b) => b.vendas.value - a.vendas.value);
  const [first, second, third] = sorted;
  return (
    <div className="glass rounded-2xl p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-cyan" />
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Ranking Closers</h3>
      </div>
      <div className="flex items-end justify-center gap-4 pt-4">
        {second && <PodiumItem closer={second} place={2} />}
        {first && <PodiumItem closer={first} place={1} />}
        {third && <PodiumItem closer={third} place={3} />}
      </div>
    </div>
  );
}
