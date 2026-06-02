import { Megaphone, Trophy } from "lucide-react";
import type { ChampionAd } from "@/lib/dashboard-data";
import { formatCompact } from "@/lib/dashboard-data";

const medal = ["🥇", "🥈", "🥉"];

export function AdRanking({ ads }: { ads: ChampionAd[] }) {
  return (
    <div className="glass rounded-2xl p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={16} className="text-cyan" />
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Anúncios Campeões
        </h3>
      </div>

      {ads.length === 0 ? (
        <div className="flex-1 grid place-items-center text-center text-sm text-muted-foreground py-8">
          Nenhuma venda atribuída a anúncio ainda.
          <br />
          Preencha a coluna <span className="text-foreground/80">Anúncio</span> na aba VENDAS.
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-widest text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 pr-2">#</th>
                <th className="text-left font-medium py-2 pr-3">Anúncio</th>
                <th className="text-left font-medium py-2 pr-3">Conjunto</th>
                <th className="text-right font-medium py-2 px-2">Vendas</th>
                <th className="text-right font-medium py-2 px-2">Receita</th>
                <th className="text-right font-medium py-2 px-2">Gasto</th>
                <th className="text-right font-medium py-2 pl-2">ROAS</th>
              </tr>
            </thead>
            <tbody>
              {ads.map((a, i) => (
                <tr key={`${a.ad}-${i}`} className="border-b border-border/40 last:border-0">
                  <td className="py-3 pr-2 text-base">{medal[i] ?? i + 1}</td>
                  <td className="py-3 pr-3 min-w-0">
                    <div className="font-display font-semibold truncate max-w-[180px]" title={a.ad}>
                      {a.ad}
                    </div>
                    {a.campaign && (
                      <div className="text-[11px] text-muted-foreground truncate max-w-[180px]" title={a.campaign}>
                        {a.campaign}
                      </div>
                    )}
                  </td>
                  <td className="py-3 pr-3 min-w-0">
                    <div className="truncate max-w-[160px] text-foreground/80" title={a.adset}>
                      {a.adset || "—"}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right tabular-nums">{a.sales}</td>
                  <td className="py-3 px-2 text-right tabular-nums font-semibold">{formatCompact(a.revenue)}</td>
                  <td className="py-3 px-2 text-right tabular-nums text-muted-foreground">
                    {a.spend > 0 ? formatCompact(a.spend) : "—"}
                  </td>
                  <td className="py-3 pl-2 text-right tabular-nums">
                    {a.roas != null ? (
                      <span
                        className="inline-flex items-center gap-1 font-bold"
                        style={{ color: a.roas >= 1 ? "var(--cyan, #22d3ee)" : "#f87171" }}
                      >
                        {i === 0 && a.roas >= 1 && <Trophy size={12} />}
                        {a.roas.toFixed(1)}x
                      </span>
                    ) : (
                      <span className="text-muted-foreground" title="Sem gasto correspondente no META_RAW">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
