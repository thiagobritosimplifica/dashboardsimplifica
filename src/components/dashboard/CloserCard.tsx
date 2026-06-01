import { Gauge } from "./Gauge";
import type { CloserStats } from "@/lib/dashboard-data";

export function CloserCard({ closer }: { closer: CloserStats }) {
  const initials = closer.name.slice(0, 2).toUpperCase();
  return (
    <div className="glass rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full grid place-items-center font-display font-bold text-sm"
             style={{ background: "var(--gradient-blue)", boxShadow: "var(--shadow-glow)" }}>
          {initials}
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Closer</div>
          <div className="font-display text-lg font-semibold">{closer.name}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Gauge label="Vendas no mês" value={closer.vendas.value} goal={closer.vendas.goal} size={104} />
        <Gauge label="TCV" value={closer.tcv.value} goal={closer.tcv.goal} size={104} />
      </div>
    </div>
  );
}
