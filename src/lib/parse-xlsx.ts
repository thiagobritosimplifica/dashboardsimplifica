import * as XLSX from "xlsx";
import type { DashboardData } from "./dashboard-data";
import { MOCK } from "./dashboard-data";

/**
 * Best-effort XLSX parser. Looks for a `Dashboard` sheet with key/value pairs
 * or falls back to mock data. Designed to be tolerant — partial files still
 * fill the dashboard, missing fields keep their previous value.
 */
export async function parseXlsx(file: File): Promise<DashboardData> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const data: DashboardData = JSON.parse(JSON.stringify(MOCK));

  const sheetByName = (name: string) =>
    wb.SheetNames.find((s) => s.toLowerCase() === name.toLowerCase());

  // Generic key/value parse from first sheet
  const firstSheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { header: 1 }) as unknown as any[][];
  const kv = new Map<string, number>();
  rows.forEach((row) => {
    if (Array.isArray(row) && row.length >= 2 && typeof row[0] === "string") {
      const num = Number(String(row[1]).replace(/[R$.\s]/g, "").replace(",", "."));
      if (!Number.isNaN(num)) kv.set(row[0].trim().toLowerCase(), num);
    }
  });
  const pick = (k: string) => kv.get(k.toLowerCase());

  if (pick("sales")) data.salesGoal.value = pick("sales")!;
  if (pick("sales goal")) data.salesGoal.goal = pick("sales goal")!;
  if (pick("tcv")) data.tcvGoal.value = pick("tcv")!;
  if (pick("tcv goal")) data.tcvGoal.goal = pick("tcv goal")!;
  if (pick("open value")) data.openValue = pick("open value")!;
  if (pick("open tcv")) data.openTcv = pick("open tcv")!;

  // Optional sheets
  const closersSheet = sheetByName("Closers");
  if (closersSheet) {
    const r = XLSX.utils.sheet_to_json<any>(wb.Sheets[closersSheet]);
    if (r.length) {
      data.closers = r.slice(0, 3).map((row) => ({
        name: String(row.name ?? row.Nome ?? "—"),
        vendas: { value: Number(row.vendas ?? row.Vendas ?? 0), goal: Number(row.vendas_goal ?? 23000) },
        tcv: { value: Number(row.tcv ?? row.TCV ?? 0), goal: Number(row.tcv_goal ?? 50000) },
      }));
    }
  }

  const sdrSheet = sheetByName("SDRs") || sheetByName("SDR");
  if (sdrSheet) {
    const r = XLSX.utils.sheet_to_json<any>(wb.Sheets[sdrSheet]);
    if (r.length) {
      data.sdrs = r.map((row) => ({
        name: String(row.name ?? row.Nome ?? "—"),
        scheduled: Number(row.scheduled ?? row.Agendadas ?? 0),
        completed: Number(row.completed ?? row.Realizadas ?? 0),
      }));
    }
  }

  const funnelSheet = sheetByName("Funnel") || sheetByName("Funil");
  if (funnelSheet) {
    const r = XLSX.utils.sheet_to_json<any>(wb.Sheets[funnelSheet]);
    if (r.length) {
      data.funnel = r.map((row) => ({
        stage: String(row.stage ?? row.Etapa ?? "—"),
        value: Number(row.value ?? row.Valor ?? 0),
      }));
    }
  }

  return data;
}
