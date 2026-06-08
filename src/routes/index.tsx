import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo-simplifica.png";
import { MOCK, type DashboardData, type GoalsConfig, formatBRL } from "@/lib/dashboard-data";
import { fetchDashboardFromSheets, saveGoalsToSheet } from "@/lib/sheets.functions";
import { ProgressGoal } from "@/components/dashboard/ProgressGoal";
import { CloserCard } from "@/components/dashboard/CloserCard";
import { MarketingStrip } from "@/components/dashboard/MarketingStrip";
import { SalesFunnel } from "@/components/dashboard/SalesFunnel";
import { CloserRanking } from "@/components/dashboard/CloserRanking";
import { SdrRanking } from "@/components/dashboard/SdrRanking";
import { AdRanking } from "@/components/dashboard/AdRanking";
import { GoalsPanel } from "@/components/dashboard/GoalsPanel";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")(
  {
  head: () => ({
    meta: [
      { title: "Simplifica — Dashboard Comercial" },
      { name: "description", content: "Visão em tempo real de metas, funil e ranking do time comercial da Simplifica." },
    ],
  }),
  component: Dashboard,
});

/** Apply user-configured goals to the fetched data. */
function applyGoals(data: DashboardData, goals: GoalsConfig): DashboardData {
  return {
    ...data,
    salesGoal: { ...data.salesGoal, goal: goals.salesGoal },
    tcvGoal: { ...data.tcvGoal, goal: goals.tcvGoal },
    marketing: { ...data.marketing, mqlsGoal: goals.mqlsGoal },
    closers: data.closers.map((c) => {
      const cg = goals.closerGoals[c.name] ?? {
        vendasGoal: goals.closerVendasGoal,
        tcvGoal: goals.closerTcvGoal,
      };
      return {
        ...c,
        vendas: { ...c.vendas, goal: cg.vendasGoal },
        tcv: { ...c.tcv, goal: cg.tcvGoal },
      };
    }),
  };
}

function Dashboard() {
  const fetchSheets = useServerFn(fetchDashboardFromSheets);
  const saveGoals = useServerFn(saveGoalsToSheet);
  const [data, setData] = useState<DashboardData>(MOCK);

  const query = useQuery({
    queryKey: ["dashboard-sheets"],
    queryFn: () => fetchSheets(),
    // Data is refreshed from the sources (Sheets + GHL) once per hour via the
    // server-side cache. The browser polls every 10 min only to pick up that
    // hourly refresh promptly on always-on displays — these polls hit the cache,
    // not the upstream sources.
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Goals come from the server (METAS_DASH_CONFIG), already applied to the data.
  useEffect(() => {
    if (query.data) setData(query.data);
  }, [query.data]);

  useEffect(() => {
    if (query.error) {
      console.error(query.error);
      toast.error("Não foi possível ler a planilha do Google Sheets");
    }
  }, [query.error]);

  const handleGoalsSave = useCallback(
    async (newGoals: GoalsConfig) => {
      // Optimistic update so the dashboard reflects the new goals immediately.
      setData((prev) => applyGoals({ ...prev, goals: newGoals }, newGoals));
      try {
        const res = await saveGoals({ data: newGoals });
        if (res.ok) {
          toast.success("Metas atualizadas e salvas na planilha!");
          // Re-sync from the sheet shortly after (allow CSV propagation).
          setTimeout(() => query.refetch(), 4000);
        } else {
          toast.error("Não foi possível salvar as metas na planilha");
        }
      } catch (e) {
        console.error(e);
        toast.error("Erro ao salvar as metas");
      }
    },
    [saveGoals, query]
  );

  return (
    <div className="min-h-screen w-full flex flex-col p-3 xl:p-4 2xl:p-5">
      <Toaster theme="dark" position="top-right" />
      <header className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-4">
          <img src={logo} alt="Simplifica" className="h-9 invert" />
          <div className="hidden md:block h-8 w-px bg-border" />
          <div className="hidden md:block">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Dashboard Comercial</div>
            <h1 className="font-display text-lg font-semibold">Visão geral em tempo real</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long" })}
            </div>
            <div className="font-display text-sm">
              {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
            </div>
          </div>
          <GoalsPanel goals={data.goals} onSave={handleGoalsSave} />
          <button
            onClick={() => query.refetch()}
            className="glass rounded-lg p-2 hover:bg-secondary/40 transition-colors"
            title="Atualizar dados da planilha"
            disabled={query.isFetching}
          >
            <RefreshCw size={16} className={query.isFetching ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 auto-rows-min content-between gap-3 xl:gap-4">
        {/* SECTION 1: Goals */}
        <section className="col-span-12 xl:col-span-9 glass rounded-2xl p-5 flex items-center">
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-center w-full">
            <div className="space-y-5">
              <ProgressGoal label="Meta de Vendas" value={data.salesGoal.value} goal={data.salesGoal.goal} />
              <ProgressGoal label="Meta de TCV" value={data.tcvGoal.value} goal={data.tcvGoal.goal} accent="cyan" />
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 lg:min-w-[240px] lg:border-l lg:pl-6 border-border">
              <Stat label="Valor em Aberto" value={formatBRL(data.openValue)} highlight />
              <Stat label="TCV em Aberto" value={formatBRL(data.openTcv)} />
            </div>
          </div>
        </section>

        {/* SECTION 6: Closer Ranking (top right) */}
        <section className="col-span-12 xl:col-span-3">
          <CloserRanking closers={data.closers} />
        </section>

        {/* SECTION 2: Closer Cards */}
        <section className="col-span-12 xl:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-3 xl:gap-4 min-h-0">
          {data.closers.map((c) => <CloserCard key={c.name} closer={c} />)}
        </section>

        {/* SECTION 7: SDR Ranking */}
        <section className="col-span-12 xl:col-span-3">
          <SdrRanking sdrs={data.sdrs} />
        </section>

        {/* SECTION 3: Marketing strip */}
        <section className="col-span-12">
          <MarketingStrip m={data.marketing} />
        </section>

        {/* SECTION 4: Funnel */}
        <section className="col-span-12 lg:col-span-5">
          <SalesFunnel stages={data.funnel} />
        </section>

        {/* SECTION 5: Champion ads ranking (by ROAS) */}
        <section className="col-span-12 lg:col-span-7">
          <AdRanking ads={data.championAds} />
        </section>
      </main>

      <footer className="mt-2 text-center text-[10px] text-muted-foreground/50 tracking-widest uppercase shrink-0">
        Simplifica · Aceleradora de Negócios
      </footer>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-secondary/30 border border-border px-4 py-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`font-display font-bold tabular-nums mt-1 ${highlight ? "text-xl text-gradient-blue" : "text-base"}`}>{value}</div>
    </div>
  );
}
