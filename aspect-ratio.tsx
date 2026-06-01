import { Trophy } from "lucide-react";
import type { SdrStats } from "@/lib/dashboard-data";

export function SdrRanking({ sdrs }: { sdrs: SdrStats[] }) {
  const top = [...sdrs].sort((a, b) => b.completed - a.completed)[0];
  if (!top) return null;
  const initials = top.name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const rate = top.scheduled ? Math.round((top.completed / top.scheduled) * 100) : 0;
  return (
    <div className="glass rounded-2xl p-5 h-full">
      <div className="flex items-center gap-2 mb-4">
        <Trophy size={16} className="text-cyan" />
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">Ranking SDR</h3>
      </div>
      <div className="flex flex-col items-center justify-center gap-3 py-4">
        <div className="text-3xl">🥇</div>
        <div
          className="h-20 w-20 rounded-full grid place-items-center font-display font-bold text-xl"
          style={{
            background: "var(--gradient-blue)",
            boxShadow: "0 0 24px oklch(0.85 0.16 90 / 0.5)",
            border: "2px solid var(--gold)",
          }}
        >
          {initials}
        </div>
        <div className="font-display font-semibold text-lg">{top.name}</div>
        <div className="grid grid-cols-2 gap-3 w-full text-center mt-2">
          <div className="rounded-lg bg-secondary/40 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Agendadas</div>
            <div className="font-display font-bold text-lg">{top.scheduled}</div>
          </div>
          <div className="rounded-lg bg-secondary/40 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Realizadas</div>
            <div className="font-display font-bold text-lg text-cyan">{top.completed}</div>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">Taxa de conversão <span className="text-cyan font-semibold">{rate}%</span></div>
      </div>
    </div>
  );
}
