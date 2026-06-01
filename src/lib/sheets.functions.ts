import { createServerFn } from "@tanstack/react-start";
import type { DashboardData } from "./dashboard-data";

// ─── Configuration ───────────────────────────────────────────────────────────
const SPREADSHEET_ID = "1hVYKI98sgpYqzgcP9vmzQnEjRbCo7asw3BUH_OnZUH0";

const SHEET_GIDS = {
  META_RAW: "1864099546",
  DADOS_DIARIOS: "1299774400",
} as const;

// ─── Server-side cache (5 minutes) ──────────────────────────────────────────
let cachedData: DashboardData | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

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

// ─── DADOS_DIARIOS processing ────────────────────────────────────────────────
function processDadosDiarios(rows: string[][]) {
  const result = {
    marketing: { invested: 0, mqls: 0 },
    funnel: {
      agendadas: 0,
      realizadas: 0,
      propostas: 0,
      vendas: 0,
    },
    closers: new Map<string, { vendas: number; tcv: number }>(),
    sdrs: new Map<string, { agendadas: number; realizadas: number }>(),
  };

  if (rows.length < 2) return result;

  const hmap = headerMap(rows[0]);

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 2) continue;

    // A tabela tem: Categoria, Nome, Valor 1, Valor 2
    // Pode não ter os headers exatos, vamos tentar pelos índices se hmap falhar
    let cat = cellVal(r, hmap, "categoria").toLowerCase();
    let nome = cellVal(r, hmap, "nome");
    let val1 = parseBR(cellVal(r, hmap, "valor 1"));
    let val2 = parseBR(cellVal(r, hmap, "valor 2"));

    // Fallback if headers don't match exact names
    if (!cat && r[0]) cat = r[0].toLowerCase();
    if (!nome && r[1]) nome = r[1];
    if (val1 === 0 && r[2]) val1 = parseBR(r[2]);
    if (val2 === 0 && r[3]) val2 = parseBR(r[3]);

    if (!cat) continue;

    if (cat.includes("marketing")) {
      if (nome.toLowerCase().includes("invest")) result.marketing.invested += val1;
      if (nome.toLowerCase().includes("mql")) result.marketing.mqls += val1;
    } 
    else if (cat.includes("funil") || cat.includes("funnel")) {
      if (nome.toLowerCase().includes("agendada")) result.funnel.agendadas += val1;
      if (nome.toLowerCase().includes("realizada")) result.funnel.realizadas += val1;
      if (nome.toLowerCase().includes("proposta")) result.funnel.propostas += val1;
      if (nome.toLowerCase().includes("venda") || nome.toLowerCase().includes("contrato")) result.funnel.vendas += val1;
    }
    else if (cat.includes("closer")) {
      const current = result.closers.get(nome) || { vendas: 0, tcv: 0 };
      current.vendas += val1;
      current.tcv += val2;
      result.closers.set(nome, current);
    }
    else if (cat.includes("sdr")) {
      const current = result.sdrs.get(nome) || { agendadas: 0, realizadas: 0 };
      current.agendadas += val1;
      current.realizadas += val2;
      result.sdrs.set(nome, current);
    }
  }

  return result;
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

    const [metaRawRows, dadosDiariosRows] = await Promise.all([
      fetchCSV(SHEET_GIDS.META_RAW),
      fetchCSV(SHEET_GIDS.DADOS_DIARIOS),
    ]);

    const meta = processMetaRaw(metaRawRows);
    const manual = processDadosDiarios(dadosDiariosRows);

    // Merge manual data with automatic data from META_RAW if manual is missing
    const invested = manual.marketing.invested > 0 ? manual.marketing.invested : meta.invested;
    const mqls = manual.marketing.mqls > 0 ? manual.marketing.mqls : meta.leads;

    const cpmql = mqls > 0 ? invested / mqls : 0;

    // Build closers
    const closers: DashboardData["closers"] = [];
    let totalVendas = 0;
    let totalTcv = 0;
    
    if (manual.closers.size > 0) {
      for (const [name, stats] of manual.closers) {
        totalVendas += stats.vendas;
        totalTcv += stats.tcv;
        closers.push({
          name,
          vendas: { value: stats.vendas, goal: 23000 }, // Goals will be overridden by client GoalsPanel
          tcv: { value: stats.tcv, goal: 50000 },
        });
      }
    } else {
      // Defaults if no manual data yet
      for (const name of ["Leonardo", "Gustavo", "Thiago"]) {
        closers.push({ name, vendas: { value: 0, goal: 23000 }, tcv: { value: 0, goal: 50000 } });
      }
    }

    const roas = invested > 0 ? totalVendas / invested : 0;

    // Build SDRs
    const sdrs: DashboardData["sdrs"] = [];
    if (manual.sdrs.size > 0) {
      for (const [name, stats] of manual.sdrs) {
        sdrs.push({ name, scheduled: stats.agendadas, completed: stats.realizadas });
      }
    } else {
      sdrs.push({ name: "Ana Clara", scheduled: 0, completed: 0 });
    }

    const data: DashboardData = {
      salesGoal: { value: totalVendas, goal: 235000 },
      tcvGoal: { value: totalTcv, goal: 750000 },
      openValue: totalVendas, // Simplified
      openTcv: totalTcv, // Simplified
      marketing: {
        invested,
        mqls,
        mqlsGoal: 400,
        cpmol: cpmql,
        marketingSales: totalVendas,
        roas,
      },
      funnel: [
        { stage: "Reunião Agendada", value: manual.funnel.agendadas },
        { stage: "Reunião Realizada", value: manual.funnel.realizadas },
        { stage: "Proposta Apresentada", value: manual.funnel.propostas },
        { stage: "Contrato Enviado", value: manual.funnel.vendas },
      ],
      closers,
      sdrs,
    };

    cachedData = data;
    cachedAt = Date.now();
    console.log(
      "[Dashboard] Cached. Manual Mode. Invested:", invested,
      "Vendas:", totalVendas,
    );

    return data;
  },
);
