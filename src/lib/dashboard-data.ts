export type CloserStats = {
  name: string;
  vendas: { value: number; goal: number };
  tcv: { value: number; goal: number };
};

// Canonical closer roster — always shown on the dashboard, even with no sales.
export const CLOSERS = ["Leonardo", "Gustavo", "Thiago"] as const;

// ─── Goals config (shared between server and client) ─────────────────────────
// Persisted in the METAS_DASH_CONFIG sheet tab (key/value), so the goals are
// the same on every device.
export type CloserGoal = { vendasGoal: number; tcvGoal: number };

export type GoalsConfig = {
  salesGoal: number;
  tcvGoal: number;
  mqlsGoal: number;
  closerVendasGoal: number; // fallback default for closers without an explicit goal
  closerTcvGoal: number;
  closerGoals: Record<string, CloserGoal>;
};

export const DEFAULT_CLOSER_VENDAS = 23000;
export const DEFAULT_CLOSER_TCV = 50000;

export const DEFAULT_GOALS: GoalsConfig = {
  salesGoal: 235000,
  tcvGoal: 750000,
  mqlsGoal: 400,
  closerVendasGoal: DEFAULT_CLOSER_VENDAS,
  closerTcvGoal: DEFAULT_CLOSER_TCV,
  closerGoals: Object.fromEntries(
    CLOSERS.map((name) => [name, { vendasGoal: DEFAULT_CLOSER_VENDAS, tcvGoal: DEFAULT_CLOSER_TCV }])
  ),
};

// Sheet key (METAS_DASH_CONFIG "chave" column) <-> per-closer goal mapping.
// Keys use the closer's lowercased first name, e.g. "leonardo_vendas".
export function closerGoalKey(name: string, field: "vendas" | "tcv"): string {
  return `${name.trim().toLowerCase()}_${field}`;
}

/**
 * Photo filename slug for any person (closer or SDR): full name, lowercased,
 * accent-stripped, spaces removed. e.g. "Ana Clara" -> "anaclara".
 * Photos live in `public/closers/<slug>.<jpeg|jpg|png|webp>`.
 */
export function personSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "");
}

export type SdrStats = {
  name: string;
  scheduled: number;
  completed: number;
};

export type ChampionAd = {
  ad: string;
  campaign: string;
  adset: string;
  revenue: number;
  spend: number;
  roas: number | null; // null when no matching spend in META_RAW
  sales: number;
};

export type DashboardData = {
  salesGoal: { value: number; goal: number };
  tcvGoal: { value: number; goal: number };
  openValue: number;
  openTcv: number;
  marketing: {
    invested: number;
    mqls: number;
    mqlsGoal: number;
    cpmol: number;
    marketingSales: number;
    roas: number;
    reunioesAgendadas: number; // this month (GHL funnel)
    reunioesRealizadas: number;
  };
  funnel: { stage: string; value: number }[];
  closers: CloserStats[];
  sdrs: SdrStats[];
  championAds: ChampionAd[];
  goals: GoalsConfig; // current goals (source of truth = METAS_DASH_CONFIG sheet)
};

export const MOCK: DashboardData = {
  salesGoal: { value: 188805.9, goal: 235000 },
  tcvGoal: { value: 589232.4, goal: 750000 },
  openValue: 47379,
  openTcv: 117116,
  marketing: {
    invested: 96000,
    mqls: 283,
    mqlsGoal: 400,
    cpmol: 340,
    marketingSales: 108000,
    roas: 1.1,
    reunioesAgendadas: 253,
    reunioesRealizadas: 193,
  },
  funnel: [
    { stage: "Reunião Agendada", value: 253 },
    { stage: "Reunião Realizada", value: 193 },
    { stage: "Proposta Apresentada", value: 162 },
    { stage: "Contrato Enviado", value: 49 },
  ],
  closers: [
    { name: "Leonardo", vendas: { value: 16401.5, goal: 23000 }, tcv: { value: 24913, goal: 50000 } },
    { name: "Gustavo", vendas: { value: 12800, goal: 23000 }, tcv: { value: 18250, goal: 50000 } },
    { name: "Thiago", vendas: { value: 9420, goal: 23000 }, tcv: { value: 14120, goal: 50000 } },
  ],
  sdrs: [{ name: "Ana Clara", scheduled: 253, completed: 193 }],
  championAds: [
    { ad: "AD01 IMG", campaign: "[CADASTRO] TRAFEGO DIRETO", adset: "01 IMG - ADV+", revenue: 9000, spend: 1850, roas: 4.86, sales: 1 },
    { ad: "AD07 TH", campaign: "[CRM] VIDEO ADV+", adset: "07 VIDEO", revenue: 7500, spend: 2100, roas: 3.57, sales: 1 },
  ],
  goals: DEFAULT_GOALS,
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const formatCompact = (n: number) => {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(0)}K`;
  return formatBRL(n);
};
