import { Trophy } from "lucide-react";
import { PersonAvatar } from "./PersonAvatar";
import type { CloserStats } from "@/lib/dashboard-data";
import { formatBRL } from "@/lib/dashboard-data";

function PodiumItem({
  closer,
  place,
}: {
  closer: CloserStats;
  place: 1 | 2 | 3;
}) {
  // Ranking is by TCV (Valor do Contrato), not Valor pago.
  const total = closer.tcv.value;
  const config = {
    1: { medal: "🥇", h: "h-16", color: "var(--gold)", ring: "oklch(0.85 0.16 90 / 0.6)", scale: "scale-105", size: "h-16 w-16", text: "text-base" },
    2: { medal: "🥈", h: "h-10", color: "var(--silver)", ring: "oklch(0.82 0.02 250 / 0.5)", scale: "", size: "h-12 w-12", text: "text-sm" },
    3: { medal: "🥉", h: "h-7", color: "var(--bronze)", ring: "oklch(0.65 0.13 55 / 0.5)", scale: "", size: "h-12 w-12", text: "text-sm" },
  }[place];

  return (
    <div className={`flex flex-col items-center gap-1.5 ${config.scale}`}>
      <div className="text-xl leading-none">{config.medal}</div>
      <PersonAvatar
        name={closer.name}
        className={config.size}
        style={{
          boxShadow: `0 0 18px ${config.ring}`,
          border: `2px solid ${config.color}`,
        }}
      />
      <div className="text-center">
        <div className={`font-display font-semibold ${config.text}`}>{closer.name}</div>
        <div className="text-xs text-cyan tabular-nums">{formatBRL(total)}</div>
      </div>
      <div
        className={`w-16 ${config.h} rounded-t-md`}
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
    .sort((a, b) => b.tcv.value - a.tcv.value);
  const [first, second, third] = sorted;
  return (
    <div className="glass rounded-2xl p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <Trophy size={16} className="text-cyan" />
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Ranking Closers</h3>
      </div>
      <div className="flex-1 flex items-end justify-center gap-4">
        {second && <PodiumItem closer={second} place={2} />}
        {first && <PodiumItem closer={first} place={1} />}
        {third && <PodiumItem closer={third} place={3} />}
      </div>
    </div>
  );
}
