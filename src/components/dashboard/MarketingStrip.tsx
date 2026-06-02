import { DollarSign, CalendarCheck, CalendarClock, Activity } from "lucide-react";
import type { DashboardData } from "@/lib/dashboard-data";
import { formatCompact, formatBRL } from "@/lib/dashboard-data";

function KpiCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl px-6 py-6 xl:py-7 flex flex-col gap-3 min-h-[150px] xl:min-h-[170px]">
      <div className="flex items-center gap-3">
        <div
          className="h-12 w-12 xl:h-14 xl:w-14 rounded-xl grid place-items-center text-primary-foreground shrink-0"
          style={{ background: "var(--gradient-blue)", boxShadow: "var(--shadow-glow)" }}
        >
          {icon}
        </div>
        <div className="text-xs xl:text-sm uppercase tracking-widest text-muted-foreground leading-tight">
          {label}
        </div>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <div className="font-display font-bold tabular-nums leading-none text-5xl xl:text-6xl 2xl:text-7xl">
          {value}
        </div>
        {sub}
      </div>
    </div>
  );
}

export function MarketingStrip({ m }: { m: DashboardData["marketing"] }) {
  const custoAgendada = m.reunioesAgendadas > 0 ? m.invested / m.reunioesAgendadas : 0;
  const custoRealizada = m.reunioesRealizadas > 0 ? m.invested / m.reunioesRealizadas : 0;
  const costSub = (label: string, value: number) => (
    <div className="text-sm xl:text-base text-muted-foreground mt-2">
      {label}{" "}
      <span className="text-cyan font-semibold tabular-nums">
        {value > 0 ? formatBRL(value) : "—"}
      </span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 xl:gap-5">
      <KpiCard icon={<DollarSign className="size-6 xl:size-7" />} label="Investido (mês)" value={formatCompact(m.invested)} />
      <KpiCard
        icon={<CalendarCheck className="size-6 xl:size-7" />}
        label="Reunião Agendada"
        value={String(m.reunioesAgendadas)}
        sub={costSub("Custo:", custoAgendada)}
      />
      <KpiCard
        icon={<CalendarClock className="size-6 xl:size-7" />}
        label="Reunião Realizada"
        value={String(m.reunioesRealizadas)}
        sub={costSub("Custo:", custoRealizada)}
      />
      <KpiCard icon={<Activity className="size-6 xl:size-7" />} label="ROAS" value={`${m.roas.toFixed(1)}x`} />
    </div>
  );
}
