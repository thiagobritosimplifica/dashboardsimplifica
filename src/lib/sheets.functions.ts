import { createServerFn } from "@tanstack/react-start";
import type { DashboardData } from "./dashboard-data";

// ─── Configuration ───────────────────────────────────────────────────────────
const SPREADSHEET_ID = "1hVYKI98sgpYqzgcP9vmzQnEjRbCo7asw3BUH_OnZUH0";

// GIDs for each sheet tab
const SHEET_GIDS = {
  META_RAW: "1864099546",   // Meta Ads daily spend data
  GHL_RAW: "23753538",      // GHL CRM leads/pipeline data
  META_MENSAL: "1036784796", // Monthly goals (currently mostly empty)
  DADOS_DIARIOS: "1299774400", // Daily rollup (currently empty)
} as const;

// Goals — hardcoded until META_MENSAL sheet is populated
const GOALS = {
  salesGoal: 235_000,
  tcvGoal: 750_000,
  mqlsGoal: 400,
  closerMrr: 40_000,
  closerOnboarding: 40_000,
  closerTotal: 23_000,
};

// ─── Server-side cache (1 hour) ──────────────────────────────────────────────
let cachedData: DashboardData | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ─── CSV helpers ─────────────────────────────────────────────────────────────
function csvExportUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
}

/** Parse a CSV string into an array of rows (each row = array of strings). */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        current.push(cell);
        cell = "";
      } else if (ch === "\r") {
        // skip
      } else if (ch === "\n") {
        current.push(cell);
        cell = "";
        rows.push(current);
        current = [];
      } else {
        cell += ch;
      }
    }
  }
  // last row
  if (cell || current.length) {
    current.push(cell);
    rows.push(current);
  }
  return rows;
}

/** Parse Brazilian number format: "1.234,56" → 1234.56 */
function parseBR(v: string | undefined): number {
  if (!v || v.trim() === "") return 0;
  const s = v.replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Build a header→index map for a CSV. */
function headerMap(headers: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(h.trim().toLowerCase(), i));
  return m;
}

/** Get a cell value by header name. */
function cell(row: string[], hmap: Map<string, number>, key: string): string {
  const idx = hmap.get(key.toLowerCase());
  if (idx == null) return "";
  return (row[idx] ?? "").trim();
}

// ─── Data aggregation ────────────────────────────────────────────────────────

/** Process META_RAW: sum Spend and Action Leads for the current month. */
function processMetaRaw(rows: string[][]): { invested: number; leads: number } {
  if (rows.length < 2) return { invested: 0, leads: 0 };
  const hmap = headerMap(rows[0]);
  let invested = 0;
  let leads = 0;

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const dateStr = cell(r, hmap, "date");
    if (!dateStr) continue;

    // Date format: YYYY-MM-DD
    const d = new Date(dateStr);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
      invested += parseBR(cell(r, hmap, "spend (cost, amount spent)"));
      leads += parseInt(cell(r, hmap, "action leads") || "0", 10) || 0;
    }
  }
  return { invested, leads };
}

/** Process GHL_RAW: count funnel stages, extract closer/SDR stats. */
function processGhlRaw(rows: string[][]): {
  funnel: { stage: string; value: number }[];
  closers: DashboardData["closers"];
  sdrs: DashboardData["sdrs"];
  totalLeads: number;
  openValue: number;
  openTcv: number;
  salesValue: number;
  tcvValue: number;
} {
  if (rows.length < 2) {
    return {
      funnel: [],
      closers: [],
      sdrs: [],
      totalLeads: 0,
      openValue: 0,
      openTcv: 0,
      salesValue: 0,
      tcvValue: 0,
    };
  }

  const hmap = headerMap(rows[0]);
  const dataRows = rows.slice(1).filter((r) => r.length > 1);

  // Count by pipeline stage
  const stageCounts = new Map<string, number>();
  const closerSales = new Map<string, { mrr: number; onboarding: number; total: number }>();
  const sdrCounts = new Map<string, { scheduled: number; completed: number }>();

  let openValue = 0;
  let openTcv = 0;
  let salesValue = 0;
  let tcvValue = 0;

  for (const r of dataRows) {
    const etapa = cell(r, hmap, "etapa atual");
    const closer = cell(r, hmap, "closer");
    const sdr = cell(r, hmap, "sdr");
    const status = cell(r, hmap, "status").toLowerCase();
    const ticketStr = cell(r, hmap, "ticket estimado");
    const reuniaoAgendada = cell(r, hmap, "reunião agendada") || cell(r, hmap, "reuni\u00e3o agendada");
    const reuniaoRealizada = cell(r, hmap, "reunião realizada") || cell(r, hmap, "reuni\u00e3o realizada");
    const propostaEnviada = cell(r, hmap, "proposta enviada");
    const vendaFechada = cell(r, hmap, "venda fechada");

    // Count stages
    if (etapa) {
      stageCounts.set(etapa, (stageCounts.get(etapa) || 0) + 1);
    }

    // Count SDR stats
    if (sdr) {
      const s = sdrCounts.get(sdr) || { scheduled: 0, completed: 0 };
      if (reuniaoAgendada) s.scheduled++;
      if (reuniaoRealizada) s.completed++;
      sdrCounts.set(sdr, s);
    }

    // Count closer stats
    if (closer) {
      const c = closerSales.get(closer) || { mrr: 0, onboarding: 0, total: 0 };
      if (vendaFechada) {
        const ticket = parseBR(ticketStr) || estimateTicket(ticketStr);
        c.total += ticket;
        salesValue += ticket;
      }
      closerSales.set(closer, c);
    }

    // Estimate ticket value from text ranges
    if (status === "open" && etapa) {
      const ticket = parseBR(ticketStr) || estimateTicket(ticketStr);
      if (ticket > 0) {
        openValue += ticket;
      }
    }
  }

  // Build funnel from GHL_RAW "Etapa Atual" column
  // Map GHL stages to dashboard funnel stages
  const reuniaoAgendadaCount = dataRows.filter((r) => {
    const etapa = cell(r, hmap, "etapa atual").toLowerCase();
    return etapa.includes("reunião agendada") || etapa.includes("reuni") && etapa.includes("agendada");
  }).length;

  const reuniaoRealizadaCount = dataRows.filter((r) => {
    const etapa = cell(r, hmap, "etapa atual").toLowerCase();
    return etapa.includes("reunião realizada") || (etapa.includes("reuni") && etapa.includes("realizada"));
  }).length;

  const propostaCount = dataRows.filter((r) => {
    const etapa = cell(r, hmap, "etapa atual").toLowerCase();
    return etapa.includes("proposta") || etapa.includes("aguardando pagamento");
  }).length;

  const vendaCount = dataRows.filter((r) => {
    const etapa = cell(r, hmap, "etapa atual").toLowerCase();
    return etapa.includes("venda") && !etapa.includes("perdida");
  }).length;

  // Build total leads count from rows with meetings scheduled
  const totalMeetingsScheduled = dataRows.filter((r) => {
    const ra = cell(r, hmap, "reunião agendada") || cell(r, hmap, "reuni\u00e3o agendada");
    return ra !== "";
  }).length || reuniaoAgendadaCount;

  const totalMeetingsCompleted = dataRows.filter((r) => {
    const rr = cell(r, hmap, "reunião realizada") || cell(r, hmap, "reuni\u00e3o realizada");
    return rr !== "";
  }).length || reuniaoRealizadaCount;

  const funnel = [
    { stage: "Reunião Agendada", value: totalMeetingsScheduled || reuniaoAgendadaCount || (stageCounts.get("Reunião Agendada") || 0) },
    { stage: "Reunião Realizada", value: totalMeetingsCompleted || reuniaoRealizadaCount },
    { stage: "Proposta Apresentada", value: propostaCount },
    { stage: "Contrato Enviado", value: vendaCount },
  ];

  // If funnel all zero, use stage counts from "Etapa Atual"
  if (funnel.every((f) => f.value === 0)) {
    // Use all non-lost leads as funnel input
    const activeLeads = dataRows.filter((r) => cell(r, hmap, "status").toLowerCase() !== "lost").length;
    const atendimento = dataRows.filter((r) => {
      const e = cell(r, hmap, "etapa atual").toLowerCase();
      return e.includes("atendimento") || e.includes("conversando");
    }).length;

    funnel[0].value = activeLeads; // all active = potential meetings
    funnel[1].value = atendimento; // in conversation = effectively met
    funnel[2].value = propostaCount || Math.round(atendimento * 0.3);
    funnel[3].value = vendaCount;
  }

  // Build closers array
  const closers: DashboardData["closers"] = [];
  for (const [name, stats] of closerSales) {
    closers.push({
      name,
      mrr: { value: stats.mrr, goal: GOALS.closerMrr },
      onboarding: { value: stats.onboarding, goal: GOALS.closerOnboarding },
      total: { value: stats.total, goal: GOALS.closerTotal },
    });
  }

  // Build SDRs array
  const sdrs: DashboardData["sdrs"] = [];
  for (const [name, stats] of sdrCounts) {
    sdrs.push({ name, scheduled: stats.scheduled, completed: stats.completed });
  }

  return {
    funnel,
    closers,
    sdrs,
    totalLeads: dataRows.length,
    openValue,
    openTcv,
    salesValue,
    tcvValue,
  };
}

/** Estimate a ticket value from text description ranges. */
function estimateTicket(text: string): number {
  if (!text) return 0;
  const t = text.toLowerCase();
  if (t.includes("menos de") && t.includes("5.000")) return 3000;
  if (t.includes("5.000") && t.includes("29.000")) return 15000;
  if (t.includes("30.000") && t.includes("49.000")) return 40000;
  if (t.includes("50.000") && t.includes("99.000")) return 75000;
  if (t.includes("100.000") && t.includes("299.000")) return 200000;
  if (t.includes("acima") && t.includes("300.000")) return 400000;
  if (t.includes("não") && t.includes("faturando")) return 2000;
  return 0;
}

/** Try to parse META_MENSAL goals (if populated). */
function processMetaMensal(rows: string[][]): Partial<typeof GOALS> {
  const result: Partial<typeof GOALS> = {};
  for (const r of rows) {
    const label = (r[0] ?? "").trim().toLowerCase();
    const value = parseBR(r[1]);
    if (value <= 0) continue;
    if (label.includes("vendas")) result.salesGoal = value;
    if (label.includes("receita")) result.tcvGoal = value;
    if (label.includes("leads")) result.mqlsGoal = value;
  }
  return result;
}

// ─── Main fetch function ─────────────────────────────────────────────────────

async function fetchCSV(gid: string): Promise<string[][]> {
  const url = csvExportUrl(gid);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.error(`Failed to fetch sheet gid=${gid}: ${res.status}`);
    return [];
  }
  const text = await res.text();
  // Check if we got HTML instead of CSV (sheet not truly public)
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    console.error(`Sheet gid=${gid} returned HTML — check sharing settings`);
    return [];
  }
  return parseCSV(text);
}

export const fetchDashboardFromSheets = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    // Return cached data if fresh
    if (cachedData && Date.now() - cachedAt < CACHE_TTL_MS) {
      console.log("[Dashboard] Returning cached data (age:", Math.round((Date.now() - cachedAt) / 1000), "s)");
      return cachedData;
    }

    console.log("[Dashboard] Fetching fresh data from Google Sheets...");

    // Fetch all sheets in parallel
    const [metaRawRows, ghlRawRows, metaMensalRows] = await Promise.all([
      fetchCSV(SHEET_GIDS.META_RAW),
      fetchCSV(SHEET_GIDS.GHL_RAW),
      fetchCSV(SHEET_GIDS.META_MENSAL),
    ]);

    // Process META_RAW (ad spend)
    const meta = processMetaRaw(metaRawRows);

    // Process GHL_RAW (pipeline/funnel)
    const ghl = processGhlRaw(ghlRawRows);

    // Try to get goals from META_MENSAL (fallback to hardcoded)
    const dynamicGoals = processMetaMensal(metaMensalRows);
    const goals = { ...GOALS, ...dynamicGoals };

    // Calculate marketing metrics
    const cpmql = meta.leads > 0 ? meta.invested / meta.leads : 0;
    const roas = meta.invested > 0 ? ghl.salesValue / meta.invested : 0;

    // Use defaults for closers/SDRs if GHL_RAW didn't have them populated
    const closers = ghl.closers.length > 0
      ? ghl.closers
      : [
          { name: "Leonardo", mrr: { value: 0, goal: goals.closerMrr }, onboarding: { value: 0, goal: goals.closerOnboarding }, total: { value: 0, goal: goals.closerTotal } },
          { name: "Gustavo", mrr: { value: 0, goal: goals.closerMrr }, onboarding: { value: 0, goal: goals.closerOnboarding }, total: { value: 0, goal: goals.closerTotal } },
          { name: "Thiago", mrr: { value: 0, goal: goals.closerMrr }, onboarding: { value: 0, goal: goals.closerOnboarding }, total: { value: 0, goal: goals.closerTotal } },
        ];

    const sdrs = ghl.sdrs.length > 0
      ? ghl.sdrs
      : [{ name: "Ana Clara", scheduled: ghl.funnel[0]?.value ?? 0, completed: ghl.funnel[1]?.value ?? 0 }];

    const data: DashboardData = {
      salesGoal: { value: ghl.salesValue || meta.invested, goal: goals.salesGoal },
      tcvGoal: { value: ghl.tcvValue || ghl.salesValue, goal: goals.tcvGoal },
      openValue: ghl.openValue,
      openTcv: ghl.openTcv,
      marketing: {
        invested: meta.invested,
        mqls: meta.leads || ghl.totalLeads,
        mqlsGoal: goals.mqlsGoal,
        cpmol: cpmql,
        marketingSales: ghl.salesValue,
        roas,
      },
      funnel: ghl.funnel,
      closers,
      sdrs,
    };

    // Cache the result
    cachedData = data;
    cachedAt = Date.now();
    console.log("[Dashboard] Data cached. Invested:", meta.invested, "Leads:", meta.leads, "GHL rows:", ghl.totalLeads);

    return data;
  },
);
