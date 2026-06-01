import { DollarSign, Users, Target, TrendingUp, Activity } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard-data";
import { formatCompact, formatBRL } from "@/lib/dashboard-data";

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="glass rounded-xl px-5 py-4 flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg grid place-items-center text-primary-foreground"
           style={{ background: "var(--gradient-blue)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <div className="font-display text-xl font-bold mt-0.5">{value}</div>
        {sub}
      </div>
    </div>
  );
}

export function MarketingStrip({ m }: { m: DashboardData["marketing"] }) {
  const mqlPct = Math.min(100, (m.mqls / m.mqlsGoal) * 100);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <KpiCard icon={<DollarSign size={18} />} label="Investido" value={formatCompact(m.invested)} />
      <KpiCard
        icon={<Users size={18} />}
        label="MQLs"
        value={String(m.mqls)}
        sub={
          <div className="mt-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${mqlPct}%`, background: "var(--gradient-blue)" }} />
          </div>
        }
      />
      <KpiCard icon={<Target size={18} />} label="CPMqL" value={formatBRL(m.cpmol)} />
      <KpiCard icon={<TrendingUp size={18} />} label="Vendas Marketing" value={formatCompact(m.marketingSales)} />
      <KpiCard icon={<Activity size={18} />} label="ROAS" value={`${m.roas.toFixed(1)}x`} />
    </div>
  );
}
