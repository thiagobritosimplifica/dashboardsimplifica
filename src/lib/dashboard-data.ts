export type CloserStats = {
  name: string;
  vendas: { value: number; goal: number };
  tcv: { value: number; goal: number };
};

// Canonical closer roster — always shown on the dashboard, even with no sales.
export const CLOSERS = ["Leonardo", "Gustavo", "Thiago"] as const;

/** First name, lowercased and accent-stripped — used for photo filenames. */
export function closerSlug(name: string): string {
  return name
    .trim()
    .split(/\s+/)[0]
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Public path to a closer's photo. Drop files in `public/closers/<slug>.png`. */
export function closerPhoto(name: string): string {
  return `/closers/${closerSlug(name)}.png`;
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
  };
  funnel: { stage: string; value: number }[];
  closers: CloserStats[];
  sdrs: SdrStats[];
  championAds: ChampionAd[];
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
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const formatCompact = (n: number) => {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(0)}K`;
  return formatBRL(n);
};
