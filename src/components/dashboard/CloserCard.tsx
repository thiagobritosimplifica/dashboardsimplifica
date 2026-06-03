import { Gauge } from "./Gauge";
import { PersonAvatar } from "./PersonAvatar";
import type { CloserStats } from "@/lib/dashboard-data";

export function CloserCard({ closer }: { closer: CloserStats }) {
  return (
    <div className="glass rounded-2xl p-5 h-full flex flex-col justify-center gap-5">
      <div className="flex items-center gap-3">
        <PersonAvatar name={closer.name} className="h-11 w-11 text-sm" />
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Closer</div>
          <div className="font-display text-lg font-semibold">{closer.name}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Gauge label="Vendas no mês" value={closer.vendas.value} goal={closer.vendas.goal} size={120} />
        <Gauge label="TCV" value={closer.tcv.value} goal={closer.tcv.goal} size={120} />
      </div>
    </div>
  );
}
