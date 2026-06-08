import { Users, Target, CalendarClock, Activity } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard-data";
import { formatBRL } from "@/lib/dashboard-data";

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
  // Cost per realizada uses only lead-generation spend (excludes "Post do
  // Instagram:" follower/boost ads), since those ads don't generate meetings.
  const custoRealizada = m.reunioesRealizadas > 0 ? m.investedLeads / m.reunioesRealizadas : 0;
  const costSub = (label: string, value: number) => (
    <div className="mt-1 flex items-baseline gap-1.5">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-display text-lg font-bold text-cyan tabular-nums leading-none">
        {value > 0 ? formatBRL(value) : "—"}
      </span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KpiCard icon={<Users size={18} />} label="Leads (mês)" value={String(m.leadsEntrada)} />
      <KpiCard
        icon={<Target size={18} />}
        label="MQL"
        value={String(m.mqls)}
        sub={costSub("CPMQL", m.cpmol)}
      />
      <KpiCard
        icon={<CalendarClock size={18} />}
        label="Reunião Realizada"
        value={String(m.reunioesRealizadas)}
        sub={costSub("Custo", custoRealizada)}
      />
      <KpiCard icon={<Activity size={18} />} label="ROAS" value={`${m.roas.toFixed(1)}x`} />
    </div>
  );
}
