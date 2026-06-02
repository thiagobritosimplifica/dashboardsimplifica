import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { DashboardData, GoalsConfig } from "./dashboard-data";
import { CLOSERS, DEFAULT_GOALS, closerGoalKey } from "./dashboard-data";
import { getGhlFunnel } from "./ghl.functions";
import { getMetasConfig } from "./config.server";

// ─── Configuration ───────────────────────────────────────────────────────────
const SPREADSHEET_ID = "1hVYKI98sgpYqzgcP9vmzQnEjRbCo7asw3BUH_OnZUH0";

const SHEET_GIDS = {
  META_RAW: "796420346",          // Ad spend per campaign/day (Meta Ads export)
  GHL_RAW: "1768392785",          // Lead CRM data (GoHighLevel raw)
  DADOS_DIARIOS: "23753538",      // Lead CRM data (daily entries)
  VENDAS: "1093065333",           // Closed deals with Closer + revenue
  METAS_DASH_CONFIG: "1668461733", // Goals (key/value) editable from the dashboard
} as const;

// ─── Server-side cache (1 hour) ─────────────────────────────────────────────
// Sheets data is pulled at most once per hour, aligned with the GHL funnel
// cache so the whole dashboard refreshes hourly.
let cachedData: DashboardData | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

// ─── CSV helpers ─────────────────────────────────────────────────────────────
function csvExportUrl(gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${gid}`;
}

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
  if (cell || current.length) {
    current.push(cell);
    rows.push(current);
  }
  return rows;
}

function parseBR(v: string | undefined): number {
  if (!v || v.trim() === "") return 0;
  // Remove R$, spaces, dot (thousands separator), then replace comma with dot
  const s = v.replace(/[R$\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function headerMap(headers: string[]): Map<string, number> {
  const m = new Map<string, number>();
  headers.forEach((h, i) => m.set(h.trim().toLowerCase(), i));
  return m;
}

function cellVal(row: string[], hmap: Map<string, number>, key: string): string {
  const idx = hmap.get(key.toLowerCase());
  if (idx == null) return "";
  return (row[idx] ?? "").trim();
}

function isNonEmpty(v: string): boolean {
  return v !== "" && v !== "0";
}

// Normalize an ad/campaign name for matching across sheets.
function normalizeAdName(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, " ");
}

// Current month as "YYYY-MM" (server timezone).
function currentMonthPrefix(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── META_RAW processing ─────────────────────────────────────────────────────
// One row per ad per day: Date, Campaign Name, Adset Name, Ad Name, ...,
//   Action Leads, ..., Spend, ...
// Note: the export sometimes includes a duplicate header row — skip it.
// Totals are restricted to the CURRENT MONTH so KPIs are monthly figures.
function processMetaRaw(rows: string[][]): {
  invested: number;
  leads: number;
  adSpend: Map<string, number>; // normalized ad name -> spend (current month)
} {
  const empty = { invested: 0, leads: 0, adSpend: new Map<string, number>() };
  if (rows.length < 2) return empty;
  const hmap = headerMap(rows[0]);
  const monthPrefix = currentMonthPrefix();
  let invested = 0;
  let leads = 0;
  const adSpend = new Map<string, number>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    // Skip duplicate header rows emitted by Google Sheets export
    if ((r[0] ?? "").trim().toLowerCase() === "date") continue;

    // Keep only the current month (Date is ISO "YYYY-MM-DD").
    const date = cellVal(r, hmap, "date");
    if (date && !date.startsWith(monthPrefix)) continue;

    const spend = parseBR(cellVal(r, hmap, "spend (cost, amount spent)"));
    invested += spend;
    leads += parseFloat(cellVal(r, hmap, "action leads").replace(",", ".")) || 0;

    const adName = cellVal(r, hmap, "ad name");
    if (adName) {
      const key = normalizeAdName(adName);
      adSpend.set(key, (adSpend.get(key) ?? 0) + spend);
    }
  }
  return { invested, leads, adSpend };
}

// ─── Lead processing (GHL_RAW + DADOS DIARIOS) ───────────────────────────────
// Both sheets: Data, Nome, Empresa, Telefone, Email, Origem, Campanha,
//   Data Entrada, Pipeline, Etapa Atual, SDR, Closer, Status, Nicho,
//   Ticket Estimado, Reunião Agendada, Reunião Realizada, Proposta Enviada,
//   Venda Fechada, Motivo Perda, Última Atualização

interface LeadRow {
  nome: string;
  telefone: string;
  email: string;
  etapa: string;
  sdr: string;
  closer: string;
  reuniaoAgendada: string;
  reuniaoRealizada: string;
  propostaEnviada: string;
  vendaFechada: string;
}

// Pipeline order: higher rank = further in funnel
// Atendimento Humano* = SDR working pre-meeting (before Reunião Agendada)
function stageRank(etapa: string): number {
  const e = etapa.toLowerCase();
  if (e.includes("venda ganha")) return 13;
  if (e.includes("aguardando pagamento")) return 11;
  if (e.includes("negoci")) return 10;
  if (e.includes("proposta")) return 10;
  if (e.includes("reuni") && e.includes("agendada")) return 9;
  if (e.includes("atendimento humano")) return 8;
  if (e.includes("qualificado")) return 5;
  if (e.includes("qualifica")) return 4;
  if (e.includes("nao responde") || e.includes("não responde")) return 3;
  if (e.includes("sauda")) return 2;
  if (e.includes("preencheu")) return 1;
  return 0;
}

function extractLeads(rows: string[][]): LeadRow[] {
  if (rows.length < 2) return [];
  const hmap = headerMap(rows[0]);
  const leads: LeadRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const nome = cellVal(r, hmap, "nome");
    if (!nome) continue; // skip blank rows

    leads.push({
      nome,
      telefone: cellVal(r, hmap, "telefone"),
      email: cellVal(r, hmap, "email"),
      etapa: cellVal(r, hmap, "etapa atual"),
      sdr: cellVal(r, hmap, "sdr"),
      closer: cellVal(r, hmap, "closer"),
      reuniaoAgendada: cellVal(r, hmap, "reunião agendada"),
      reuniaoRealizada: cellVal(r, hmap, "reunião realizada"),
      propostaEnviada: cellVal(r, hmap, "proposta enviada"),
      vendaFechada: cellVal(r, hmap, "venda fechada"),
    });
  }
  return leads;
}

// Funnel predicates — CUMULATIVE: a lead counts at stage X if they
// reached OR passed that stage (based on current Etapa Atual).
function isAgendada(l: LeadRow): boolean {
  return stageRank(l.etapa) >= 9 || isNonEmpty(l.reuniaoAgendada);
}

function isRealizada(l: LeadRow): boolean {
  // Post-meeting: negotiation or beyond implies meeting was completed
  return stageRank(l.etapa) >= 10 || isNonEmpty(l.reuniaoRealizada);
}

function isProposta(l: LeadRow): boolean {
  return stageRank(l.etapa) >= 11 || isNonEmpty(l.propostaEnviada);
}

function isVendaGanha(l: LeadRow): boolean {
  return stageRank(l.etapa) >= 13 || isNonEmpty(l.vendaFechada);
}

function processLeads(
  ghlRows: string[][],
  dadosRows: string[][]
): {
  funnel: { agendadas: number; realizadas: number; propostas: number; vendas: number };
  sdrMap: Map<string, { agendadas: number; realizadas: number }>;
  closerMap: Map<string, { vendas: number; tcv: number }>;
  totalLeads: number;
} {
  const ghlLeads = extractLeads(ghlRows);
  const dadosLeads = extractLeads(dadosRows);
  const normalizePhone = (p: string) => p.replace(/\D/g, "");

  // Smart merge: deduplicate by phone/name, keeping the most advanced stage.
  // When updating from a more-advanced duplicate, preserve SDR/Closer from GHL
  // (GHL has the SDR assignments; DADOS_DIARIOS may have more recent stage info).
  const leadMap = new Map<string, LeadRow>();

  for (const lead of [...ghlLeads, ...dadosLeads]) {
    const phone = normalizePhone(lead.telefone);
    const key = phone || lead.nome.toLowerCase().trim();
    if (!key) continue;

    const existing = leadMap.get(key);
    if (!existing) {
      leadMap.set(key, lead);
    } else if (stageRank(lead.etapa) > stageRank(existing.etapa)) {
      // Keep the more advanced stage; preserve SDR/Closer from whichever has them
      leadMap.set(key, {
        ...lead,
        sdr: existing.sdr || lead.sdr,
        closer: existing.closer || lead.closer,
        reuniaoAgendada: existing.reuniaoAgendada || lead.reuniaoAgendada,
        reuniaoRealizada: existing.reuniaoRealizada || lead.reuniaoRealizada,
        propostaEnviada: existing.propostaEnviada || lead.propostaEnviada,
        vendaFechada: existing.vendaFechada || lead.vendaFechada,
      });
    }
  }

  const allLeads = Array.from(leadMap.values());

  const funnel = {
    agendadas: allLeads.filter(isAgendada).length,
    realizadas: allLeads.filter(isRealizada).length,
    propostas: allLeads.filter(isProposta).length,
    vendas: allLeads.filter(isVendaGanha).length,
  };

  const sdrMap = new Map<string, { agendadas: number; realizadas: number }>();
  const closerMap = new Map<string, { vendas: number; tcv: number }>();

  for (const lead of allLeads) {
    if (lead.sdr) {
      const s = sdrMap.get(lead.sdr) ?? { agendadas: 0, realizadas: 0 };
      if (isAgendada(lead)) s.agendadas++;
      if (isRealizada(lead)) s.realizadas++;
      sdrMap.set(lead.sdr, s);
    }
    if (lead.closer) {
      const c = closerMap.get(lead.closer) ?? { vendas: 0, tcv: 0 };
      if (isVendaGanha(lead)) c.vendas++;
      closerMap.set(lead.closer, c);
    }
  }

  return { funnel, sdrMap, closerMap, totalLeads: allLeads.length };
}

// ─── SDR meetings (DADOS DIARIOS) ────────────────────────────────────────────
// "Reuniões por SDR" / "Ranking SDR" are driven by DADOS DIARIOS, which logs the
// daily pipeline movements. We count CURRENT-MONTH rows whose Etapa Atual (col J)
// is exactly "Reunião Agendada" (-> agendadas) or "Reunião Realizada/R2"
// (-> realizadas), grouped by the SDR column (col K). Rows with no SDR filled in
// are attributed to the default SDR.
const DEFAULT_SDR = "Ana Clara";

// DADOS DIARIOS "Data" is BR format "D/M/YYYY" or "DD/MM/YYYY".
function isCurrentMonthBR(dateStr: string): boolean {
  const parts = dateStr.trim().split("/");
  if (parts.length !== 3) return false;
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  const now = new Date();
  return month === now.getMonth() + 1 && year === now.getFullYear();
}

function processSdrMeetings(
  dadosRows: string[][]
): Map<string, { agendadas: number; realizadas: number }> {
  const map = new Map<string, { agendadas: number; realizadas: number }>();
  if (dadosRows.length < 2) return map;
  const hmap = headerMap(dadosRows[0]);

  for (let i = 1; i < dadosRows.length; i++) {
    const r = dadosRows[i];
    if (!r || r.length < 2) continue;

    // Only the current month, by the "Data" (daily movement date) column.
    if (!isCurrentMonthBR(cellVal(r, hmap, "data"))) continue;

    const etapa = cellVal(r, hmap, "etapa atual").toLowerCase();
    const agendada = etapa.includes("reuni") && etapa.includes("agendada");
    const realizada = etapa.includes("realizada"); // "Reunião Realizada/R2"
    if (!agendada && !realizada) continue;

    const sdr = cellVal(r, hmap, "sdr") || DEFAULT_SDR;
    const s = map.get(sdr) ?? { agendadas: 0, realizadas: 0 };
    if (agendada) s.agendadas++;
    if (realizada) s.realizadas++;
    map.set(sdr, s);
  }
  return map;
}

// ─── VENDAS processing ───────────────────────────────────────────────────────
// Columns: Cliente, Data Fechamento, Closer, Campanha, Conjunto, Anúncio,
//          Serviço, Plano, Setup, Mensalidade, Receita Total, Tempo Contrato,
//          LTV, Status
interface AdSale {
  ad: string;
  campaign: string;
  adset: string;
  revenue: number;
  sales: number;
}
function processVendas(rows: string[][]): {
  closers: Map<string, { vendas: number; tcv: number }>;
  totalVendas: number;
  totalTcv: number;
  adSales: Map<string, AdSale>; // normalized ad name -> aggregated sales
} {
  const result = {
    closers: new Map<string, { vendas: number; tcv: number }>(),
    totalVendas: 0,
    totalTcv: 0,
    adSales: new Map<string, AdSale>(),
  };

  if (rows.length < 2) return result;
  const hmap = headerMap(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 2) continue;
    const cliente = cellVal(r, hmap, "cliente");
    if (!cliente) continue;

    const closer = cellVal(r, hmap, "closer");
    const setup = parseBR(cellVal(r, hmap, "setup"));
    const mensalidade = parseBR(cellVal(r, hmap, "mensalidade"));
    const tempoStr = cellVal(r, hmap, "tempo contrato");
    const tempoMeses = parseFloat(tempoStr.replace(",", ".")) || 0;
    const receitaTotal =
      parseBR(cellVal(r, hmap, "receita total")) ||
      setup + mensalidade * tempoMeses;
    const ltv = parseBR(cellVal(r, hmap, "ltv")) || receitaTotal;

    // "vendas" = setup (first payment), TCV = LTV over contract term
    const vendaValor = setup || receitaTotal;
    const tcvValor = ltv || receitaTotal;

    result.totalVendas += vendaValor;
    result.totalTcv += tcvValor;

    if (closer) {
      const c = result.closers.get(closer) ?? { vendas: 0, tcv: 0 };
      c.vendas += vendaValor;
      c.tcv += tcvValor;
      result.closers.set(closer, c);
    }

    // Attribute the sale revenue to its ad (Anúncio) for the champion-ads ranking.
    const ad = cellVal(r, hmap, "anúncio") || cellVal(r, hmap, "anuncio");
    if (ad) {
      const key = normalizeAdName(ad);
      const a = result.adSales.get(key) ?? {
        ad,
        campaign: cellVal(r, hmap, "campanha"),
        adset: cellVal(r, hmap, "conjunto"),
        revenue: 0,
        sales: 0,
      };
      a.revenue += receitaTotal;
      a.sales += 1;
      result.adSales.set(key, a);
    }
  }

  return result;
}

// ─── METAS_DASH_CONFIG processing (goals) ────────────────────────────────────
// Key/value tab ("chave" | "valor"). Missing/empty values fall back to defaults.
function processGoals(rows: string[][]): GoalsConfig {
  // Deep-clone defaults so we never mutate the shared object.
  const goals: GoalsConfig = {
    ...DEFAULT_GOALS,
    closerGoals: Object.fromEntries(
      Object.entries(DEFAULT_GOALS.closerGoals).map(([k, v]) => [k, { ...v }])
    ),
  };
  if (rows.length < 2) return goals;
  const hmap = headerMap(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length < 1) continue;
    const key = (cellVal(r, hmap, "chave") || r[0] || "").trim().toLowerCase();
    const valStr = cellVal(r, hmap, "valor") || r[1] || "";
    if (!key || valStr.trim() === "") continue;
    const val = parseBR(valStr);
    if (!Number.isFinite(val)) continue;

    if (key === "meta_vendas") goals.salesGoal = val;
    else if (key === "meta_tcv") goals.tcvGoal = val;
    else if (key === "meta_mqls") goals.mqlsGoal = val;
    else {
      const m = key.match(/^(.+)_(vendas|tcv)$/);
      if (m) {
        const closerName = CLOSERS.find((c) => c.toLowerCase() === m[1]);
        if (closerName) {
          const cg = goals.closerGoals[closerName] ?? {
            vendasGoal: DEFAULT_GOALS.closerVendasGoal,
            tcvGoal: DEFAULT_GOALS.closerTcvGoal,
          };
          if (m[2] === "vendas") cg.vendasGoal = val;
          else cg.tcvGoal = val;
          goals.closerGoals[closerName] = cg;
        }
      }
    }
  }
  return goals;
}

// Flatten a GoalsConfig into the sheet's key/value map for writing.
function goalsToSheetMap(goals: GoalsConfig): Record<string, number> {
  const map: Record<string, number> = {
    meta_vendas: goals.salesGoal,
    meta_tcv: goals.tcvGoal,
    meta_mqls: goals.mqlsGoal,
  };
  for (const name of CLOSERS) {
    const cg = goals.closerGoals[name] ?? {
      vendasGoal: goals.closerVendasGoal,
      tcvGoal: goals.closerTcvGoal,
    };
    map[closerGoalKey(name, "vendas")] = cg.vendasGoal;
    map[closerGoalKey(name, "tcv")] = cg.tcvGoal;
  }
  return map;
}

// ─── Fetch CSV ───────────────────────────────────────────────────────────────
async function fetchCSV(gid: string): Promise<string[][]> {
  const url = csvExportUrl(gid);
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.error(`[Sheets] Failed gid=${gid}: HTTP ${res.status}`);
      return [];
    }
    const text = await res.text();
    if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
      console.error(`[Sheets] gid=${gid} returned HTML — check sharing settings`);
      return [];
    }
    return parseCSV(text);
  } catch (e) {
    console.error(`[Sheets] Fetch error gid=${gid}:`, e);
    return [];
  }
}

// ─── Main server function ────────────────────────────────────────────────────
export const fetchDashboardFromSheets = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    if (cachedData && Date.now() - cachedAt < CACHE_TTL_MS) {
      console.log("[Dashboard] Cache hit (age:", Math.round((Date.now() - cachedAt) / 1000), "s)");
      return cachedData;
    }

    console.log("[Dashboard] Fetching fresh data from Google Sheets...");

    const [metaRawRows, ghlRawRows, dadosDiariosRows, vendasRows, metasRows, ghlFunnel] =
      await Promise.all([
        fetchCSV(SHEET_GIDS.META_RAW),
        fetchCSV(SHEET_GIDS.GHL_RAW),
        fetchCSV(SHEET_GIDS.DADOS_DIARIOS),
        fetchCSV(SHEET_GIDS.VENDAS),
        fetchCSV(SHEET_GIDS.METAS_DASH_CONFIG),
        getGhlFunnel(), // live CRM funnel (own 1-hour cache)
      ]);

    const meta = processMetaRaw(metaRawRows);
    const leads = processLeads(ghlRawRows, dadosDiariosRows);
    const vendas = processVendas(vendasRows);
    const goals = processGoals(metasRows);

    console.log("[Dashboard] meta:", meta);
    console.log("[Dashboard] leads:", leads.totalLeads, "unique, funnel:", leads.funnel);
    console.log("[Dashboard] vendas:", vendas.totalVendas, "TCV:", vendas.totalTcv);

    // Invested + MQLs: Meta Ads data is the source of truth for ad spend.
    // MQLs = leads created THIS MONTH (from the live CRM), else sheet count.
    const crmLeadsThisMonth = ghlFunnel?.leadsThisMonth ?? leads.totalLeads;
    const invested = meta.invested;
    const mqls = meta.leads > 0 ? meta.leads : crmLeadsThisMonth;
    const cpmql = mqls > 0 ? invested / mqls : 0;

    // Sales + TCV: the VENDAS tab is the source of truth for closed revenue.
    // A row is created there automatically whenever a deal is won in GHL, so
    // "Meta de Vendas" reflects closed sales regardless of whether the Closer
    // column is filled in yet.
    const totalVendas = vendas.totalVendas;
    const totalTcv = vendas.totalTcv;

    // Always show the full closer roster (canonical + any extra name found in
    // VENDAS), filling each closer's sales from VENDAS — 0 when they have none.
    // Goals here are placeholders; the client GoalsPanel overrides them.
    const closerNames = [
      ...CLOSERS,
      ...[...vendas.closers.keys()].filter((n) => !CLOSERS.includes(n as (typeof CLOSERS)[number])),
    ];
    const closers: DashboardData["closers"] = closerNames.map((name) => {
      const stats = vendas.closers.get(name) ?? { vendas: 0, tcv: 0 };
      const cg = goals.closerGoals[name] ?? {
        vendasGoal: goals.closerVendasGoal,
        tcvGoal: goals.closerTcvGoal,
      };
      return {
        name,
        vendas: { value: stats.vendas, goal: cg.vendasGoal },
        tcv: { value: stats.tcv, goal: cg.tcvGoal },
      };
    });

    const roas = invested > 0 ? totalVendas / invested : 0;

    // Champion ads: cross-reference VENDAS (revenue per ad) with META_RAW
    // (spend per ad) and rank by ROAS. Ads whose name isn't found in META_RAW
    // (no spend data this month) get roas=null and sort after the matched ones.
    const championAds: DashboardData["championAds"] = [];
    for (const [key, a] of vendas.adSales) {
      const spend = meta.adSpend.get(key) ?? 0;
      championAds.push({
        ad: a.ad,
        campaign: a.campaign,
        adset: a.adset,
        revenue: a.revenue,
        spend,
        roas: spend > 0 ? a.revenue / spend : null,
        sales: a.sales,
      });
    }
    championAds.sort((x, y) => {
      // ROAS desc; ads without spend data go last (ranked by revenue among themselves)
      if (x.roas != null && y.roas != null) return y.roas - x.roas;
      if (x.roas != null) return -1;
      if (y.roas != null) return 1;
      return y.revenue - x.revenue;
    });
    console.log("[Dashboard] championAds:", championAds.length, championAds.map((a) => `${a.ad}=${a.roas ?? "?"}x`).join(", "));

    // SDR meetings from DADOS DIARIOS (current month, Etapa Atual = Reunião
    // Agendada / Reunião Realizada/R2), grouped by SDR.
    const sdrMeetings = processSdrMeetings(dadosDiariosRows);
    const sdrs: DashboardData["sdrs"] = [];
    if (sdrMeetings.size > 0) {
      for (const [name, stats] of sdrMeetings) {
        sdrs.push({ name, scheduled: stats.agendadas, completed: stats.realizadas });
      }
    } else {
      sdrs.push({ name: DEFAULT_SDR, scheduled: 0, completed: 0 });
    }
    console.log("[Dashboard] sdrMeetings:", [...sdrMeetings.entries()].map(([n, s]) => `${n}: ${s.agendadas}ag/${s.realizadas}re`).join(", ") || "(nenhuma este mês)");

    // Reunião Agendada / Realizada (marketing strip) = current-month totals from
    // DADOS DIARIOS, summed across SDRs. Pulled automatically from the sheet.
    let reunioesAgendadas = 0;
    let reunioesRealizadas = 0;
    for (const s of sdrMeetings.values()) {
      reunioesAgendadas += s.agendadas;
      reunioesRealizadas += s.realizadas;
    }

    // "Valor em Aberto" = total value of opps currently in the GHL "Negociação"
    // stage. Falls back to closed sales only if the CRM funnel is unavailable.
    const openValue = ghlFunnel?.negociacaoValue ?? totalVendas;

    // Funnel: prefer the live CRM (GHL) data; fall back to the sheets.
    const funnelStages = ghlFunnel?.stages ?? [
      { stage: "Reunião Agendada", value: leads.funnel.agendadas },
      { stage: "Reunião Realizada", value: leads.funnel.realizadas },
      { stage: "Proposta Apresentada", value: leads.funnel.propostas },
      { stage: "Contrato Enviado", value: leads.funnel.vendas },
    ];

    const data: DashboardData = {
      salesGoal: { value: totalVendas, goal: goals.salesGoal },
      tcvGoal: { value: totalTcv, goal: goals.tcvGoal },
      openValue,
      openTcv: totalTcv,
      marketing: {
        invested,
        mqls,
        mqlsGoal: goals.mqlsGoal,
        cpmol: cpmql,
        marketingSales: totalVendas,
        roas,
        reunioesAgendadas,
        reunioesRealizadas,
      },
      funnel: funnelStages,
      closers,
      sdrs,
      championAds,
      goals,
    };

    cachedData = data;
    cachedAt = Date.now();
    console.log("[Dashboard] Done. Reuniões (DADOS DIARIOS mês):", reunioesAgendadas, "ag /", reunioesRealizadas, "re | Goals:", goals.salesGoal, goals.tcvGoal);

    return data;
  },
);

// ─── Save goals to the sheet (via the Apps Script web app) ───────────────────
const closerGoalSchema = z.object({ vendasGoal: z.number(), tcvGoal: z.number() });
const goalsSchema = z.object({
  salesGoal: z.number(),
  tcvGoal: z.number(),
  mqlsGoal: z.number(),
  closerVendasGoal: z.number(),
  closerTcvGoal: z.number(),
  closerGoals: z.record(z.string(), closerGoalSchema),
});

export const saveGoalsToSheet = createServerFn({ method: "POST" })
  .inputValidator(goalsSchema)
  .handler(async ({ data: goals }): Promise<{ ok: boolean }> => {
    const cfg = getMetasConfig();
    try {
      const res = await fetch(cfg.writeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cfg.token, goals: goalsToSheetMap(goals as GoalsConfig) }),
        redirect: "follow",
      });
      const text = await res.text();
      const ok = text.includes('"ok":true');
      if (!ok) console.error("[Goals] Save failed, response:", text.slice(0, 200));
      // Invalidate the dashboard cache so the next fetch returns the new goals.
      cachedData = null;
      cachedAt = 0;
      console.log("[Goals] Saved to sheet:", ok, goalsToSheetMap(goals as GoalsConfig));
      return { ok };
    } catch (e) {
      console.error("[Goals] Save error:", e);
      return { ok: false };
    }
  });
