import { createServerFn } from "@tanstack/react-start";
import type { DashboardData } from "./dashboard-data";

// ─── Configuration ───────────────────────────────────────────────────────────
const SPREADSHEET_ID = "1hVYKI98sgpYqzgcP9vmzQnEjRbCo7asw3BUH_OnZUH0";

const SHEET_GIDS = {
  META_RAW: "1864099546",
  GHL_RAW: "23753538",
} as const;

// ─── Server-side cache (5 minutes) ──────────────────────────────────────────
let cachedData: DashboardData | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

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
  const s = v.replace(/[R$\s.]/g, "").replace(",", ".");
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

// ─── META_RAW processing ─────────────────────────────────────────────────────
// Use ALL rows in the sheet (the sheet itself is month-scoped from Meta export)
function processMetaRaw(rows: string[][]): { invested: number; leads: number } {
  if (rows.length < 2) return { invested: 0, leads: 0 };
  const hmap = headerMap(rows[0]);
  let invested = 0;
  let leads = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    invested += parseBR(cellVal(r, hmap, "spend (cost, amount spent)"));
    leads += parseInt(cellVal(r, hmap, "action leads") || "0", 10) || 0;
  }
  return { invested, leads };
}

// ─── GHL_RAW processing ──────────────────────────────────────────────────────
function processGhlRaw(rows: string[][]) {
  if (rows.length < 2) {
    return {
      totalLeads: 0,
      reuniaoAgendada: 0,
      reuniaoRealizada: 0,
      propostaEnviada: 0,
      vendaFechada: 0,
      closerMap: new Map<string, { sales: number; count: number }>(),
      sdrMap: new Map<string, { scheduled: number; completed: number }>(),
      openValue: 0,
    };
  }

  const hmap = headerMap(rows[0]);
  const dataRows = rows.slice(1).filter((r) => r.length > 1);

  let reuniaoAgendada = 0;
  let reuniaoRealizada = 0;
  let propostaEnviada = 0;
  let vendaFechada = 0;
  let openValue = 0;

  const closerMap = new Map<string, { sales: number; count: number }>();
  const sdrMap = new Map<string, { scheduled: number; completed: number }>();

  for (const r of dataRows) {
    const etapa = cellVal(r, hmap, "etapa atual").toLowerCase();
    const closer = cellVal(r, hmap, "closer");
    const sdr = cellVal(r, hmap, "sdr");
    const status = cellVal(r, hmap, "status").toLowerCase();
    const ticketStr = cellVal(r, hmap, "ticket estimado");

    // ── Count funnel by "Etapa Atual" ──
    // Reunião Agendada: the stage itself, plus all stages AFTER it
    if (
      etapa.includes("agendada") ||
      etapa.includes("realizada") ||
      etapa.includes("proposta") ||
      etapa.includes("aguardando pagamento") ||
      (etapa.includes("venda") && !etapa.includes("perdida"))
    ) {
      reuniaoAgendada++;
    }

    // Reunião Realizada: realized + all stages after
    if (
      etapa.includes("realizada") ||
      etapa.includes("proposta") ||
      etapa.includes("aguardando pagamento") ||
      (etapa.includes("venda") && !etapa.includes("perdida"))
    ) {
      reuniaoRealizada++;
    }

    // Proposta Enviada
    if (
      etapa.includes("proposta") ||
      etapa.includes("aguardando pagamento") ||
      (etapa.includes("venda") && !etapa.includes("perdida"))
    ) {
      propostaEnviada++;
    }

    // Venda Fechada / Aguardando Pagamento (closed or about to close)
    if (
      etapa.includes("aguardando pagamento") ||
      (etapa.includes("venda") && !etapa.includes("perdida"))
    ) {
      vendaFechada++;
    }

    // Estimate ticket value for open deals
    if (status === "open" && ticketStr) {
      openValue += estimateTicket(ticketStr);
    }

    // Closer stats
    if (closer) {
      const c = closerMap.get(closer) || { sales: 0, count: 0 };
      c.count++;
      if (etapa.includes("aguardando pagamento") || (etapa.includes("venda") && !etapa.includes("perdida"))) {
        c.sales += estimateTicket(ticketStr);
      }
      closerMap.set(closer, c);
    }

    // SDR stats
    if (sdr) {
      const s = sdrMap.get(sdr) || { scheduled: 0, completed: 0 };
      if (etapa.includes("agendada") || etapa.includes("realizada") || etapa.includes("proposta") || etapa.includes("aguardando")) {
        s.scheduled++;
      }
      if (etapa.includes("realizada") || etapa.includes("proposta") || etapa.includes("aguardando")) {
        s.completed++;
      }
      sdrMap.set(sdr, s);
    }
  }

  return {
    totalLeads: dataRows.length,
    reuniaoAgendada,
    reuniaoRealizada,
    propostaEnviada,
    vendaFechada,
    closerMap,
    sdrMap,
    openValue,
  };
}

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

// ─── Fetch CSV ───────────────────────────────────────────────────────────────
async function fetchCSV(gid: string): Promise<string[][]> {
  const url = csvExportUrl(gid);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    console.error(`Failed to fetch sheet gid=${gid}: ${res.status}`);
    return [];
  }
  const text = await res.text();
  if (text.trim().startsWith("<!DOCTYPE") || text.trim().startsWith("<html")) {
    console.error(`Sheet gid=${gid} returned HTML — check sharing settings`);
    return [];
  }
  return parseCSV(text);
}

// ─── Main server function ────────────────────────────────────────────────────
export const fetchDashboardFromSheets = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    // Return cached data if fresh
    if (cachedData && Date.now() - cachedAt < CACHE_TTL_MS) {
      console.log("[Dashboard] Cache hit (age:", Math.round((Date.now() - cachedAt) / 1000), "s)");
      return cachedData;
    }

    console.log("[Dashboard] Fetching fresh data from Google Sheets...");

    const [metaRawRows, ghlRawRows] = await Promise.all([
      fetchCSV(SHEET_GIDS.META_RAW),
      fetchCSV(SHEET_GIDS.GHL_RAW),
    ]);

    const meta = processMetaRaw(metaRawRows);
    const ghl = processGhlRaw(ghlRawRows);

    const cpmql = meta.leads > 0 ? meta.invested / meta.leads : 0;
    const roas = meta.invested > 0 ? ghl.openValue / meta.invested : 0;

    // Build closers — if none in GHL, use defaults with zero
    const closers: DashboardData["closers"] = [];
    if (ghl.closerMap.size > 0) {
      for (const [name, stats] of ghl.closerMap) {
        closers.push({
          name,
          mrr: { value: stats.sales * 0.4, goal: 40000 },
          onboarding: { value: stats.sales * 0.35, goal: 40000 },
          total: { value: stats.sales, goal: 23000 },
        });
      }
    } else {
      for (const name of ["Leonardo", "Gustavo", "Thiago"]) {
        closers.push({
          name,
          mrr: { value: 0, goal: 40000 },
          onboarding: { value: 0, goal: 40000 },
          total: { value: 0, goal: 23000 },
        });
      }
    }

    // Build SDRs
    const sdrs: DashboardData["sdrs"] = [];
    if (ghl.sdrMap.size > 0) {
      for (const [name, stats] of ghl.sdrMap) {
        sdrs.push({ name, scheduled: stats.scheduled, completed: stats.completed });
      }
    } else {
      sdrs.push({
        name: "Ana Clara",
        scheduled: ghl.reuniaoAgendada,
        completed: ghl.reuniaoRealizada,
      });
    }

    const data: DashboardData = {
      salesGoal: { value: meta.invested, goal: 235000 },
      tcvGoal: { value: ghl.openValue, goal: 750000 },
      openValue: ghl.openValue,
      openTcv: ghl.openValue,
      marketing: {
        invested: meta.invested,
        mqls: meta.leads || ghl.totalLeads,
        mqlsGoal: 400,
        cpmol: cpmql,
        marketingSales: ghl.openValue,
        roas,
      },
      funnel: [
        { stage: "Reunião Agendada", value: ghl.reuniaoAgendada },
        { stage: "Reunião Realizada", value: ghl.reuniaoRealizada },
        { stage: "Proposta Apresentada", value: ghl.propostaEnviada },
        { stage: "Contrato Enviado", value: ghl.vendaFechada },
      ],
      closers,
      sdrs,
    };

    cachedData = data;
    cachedAt = Date.now();
    console.log(
      "[Dashboard] Cached. Invested:", meta.invested,
      "Leads:", meta.leads,
      "GHL leads:", ghl.totalLeads,
      "Funnel:", ghl.reuniaoAgendada, ghl.reuniaoRealizada, ghl.propostaEnviada, ghl.vendaFechada,
    );

    return data;
  },
);
