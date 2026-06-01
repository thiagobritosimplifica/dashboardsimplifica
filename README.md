export type CloserStats = {
  name: string;
  mrr: { value: number; goal: number };
  onboarding: { value: number; goal: number };
  total: { value: number; goal: number };
};

export type SdrStats = {
  name: string;
  scheduled: number;
  completed: number;
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
    { name: "Leonardo", mrr: { value: 24913, goal: 40000 }, onboarding: { value: 21594.5, goal: 40000 }, total: { value: 16401.5, goal: 23000 } },
    { name: "Gustavo", mrr: { value: 18250, goal: 40000 }, onboarding: { value: 15200, goal: 40000 }, total: { value: 12800, goal: 23000 } },
    { name: "Thiago", mrr: { value: 14120, goal: 40000 }, onboarding: { value: 11020, goal: 40000 }, total: { value: 9420, goal: 23000 } },
  ],
  sdrs: [{ name: "Ana Clara", scheduled: 253, completed: 193 }],
};

export const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });

export const formatCompact = (n: number) => {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(0)}K`;
  return formatBRL(n);
};
