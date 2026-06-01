import { createServerFn } from "@tanstack/react-start";
import type { DashboardData } from "./dashboard-data";

const SPREADSHEET_ID = "168cIq8LQUdzfAUUDhU8lRqCd0HQ5p1coqm7I9nxJnyM";
const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

const MONTHS_PT = [
  "JAN", "FEV", "MAR", "ABR", "MAI", "JUN",
  "JUL", "AGO", "SET", "OUT", "NOV", "DEZ",
];

function currentSheetName(now = new Date()): string {
  const m = MONTHS_PT[now.getMonth()];
  const yy = String(now.getFullYear()).slice(-2);
  // Sheets in this workbook are formatted like "MAI 26" / "JAN 26".
  return `${m} ${yy}`;
}

function parseBR(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function parseInt0(v: unknown): number {
  if (v == null) return 0;
  const s = String(v).replace(/[^\d-]/g, "");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

// Find first row whose first non-empty column-B label matches.
function findRow(rows: any[][], label: string, startAt = 0): any[] | undefined {
  const target = label.trim().toLowerCase();
  for (let i = startAt; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const cell = String(r[1] ?? r[2] ?? "").trim().toLowerCase();
    if (cell === target) return r;
  }
  return undefined;
}

// Find by the label in column C (the per-section row labels).
function findRowC(rows: any[][], label: string): any[] | undefined {
  const target = label.trim().toLowerCase();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] ?? [];
    if (String(r[2] ?? "").trim().toLowerCase() === target) return r;
  }
  return undefined;
}

// Find section (column B label) and read subsequent rows by column-C label
// until the next non-empty B label is encountered.
function findSection(rows: any[][], sectionLabel: string): any[][] {
  const target = sectionLabel.trim().toLowerCase();
  const out: any[][] = [];
  let inSection = false;
  for (const r of rows) {
    const b = String(r?.[1] ?? "").trim().toLowerCase();
    if (!inSection) {
      if (b === target) {
        inSection = true;
        out.push(r);
      }
    } else {
      if (b && b !== target) break;
      out.push(r);
    }
  }
  return out;
}

function rowInSection(section: any[][], label: string): any[] | undefined {
  const target = label.trim().toLowerCase();
  return section.find((r) => String(r?.[2] ?? "").trim().toLowerCase() === target);
}

export const fetchDashboardFromSheets = createServerFn({ method: "GET" }).handler(
  async (): Promise<DashboardData> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const conn = process.env.GOOGLE_SHEETS_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!conn) throw new Error("GOOGLE_SHEETS_API_KEY is not configured");

    const sheetName = currentSheetName();
    const url = `${GATEWAY}/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(sheetName)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Connection-Api-Key": conn,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Sheets API failed [${res.status}]: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { values?: any[][] };
    const rows = json.values ?? [];

    // GERAL block — column D (index 3) holds REALIZADO totals for the month.
    const lead = findRow(rows, "LEAD");
    const mql = findRow(rows, "MQL");
    const raTt = findRow(rows, "RA TT");
    const rrTt = findRow(rows, "RR TT");
    const vendaTt = findRow(rows, "VENDA TT");
    const cpmql = findRow(rows, "CPMQL");
    const invt = findRow(rows, "INVT");

    const tcvValue = parseBR(vendaTt?.[3]);
    const mqlsValue = parseInt0(mql?.[3]);
    const mqlsGoal = parseInt0(mql?.[2]) || 0;
    const invested = parseBR(invt?.[3]);
    const cpmqlValue = parseBR(cpmql?.[3]);

    const leadCount = parseInt0(lead?.[3]);
    const raCount = parseInt0(raTt?.[3]);
    const rrCount = parseInt0(rrTt?.[3]);

    // Section COMERCIAL DIRETO — per-closer realized meetings (the TT column, idx 3)
    const directSection = findSection(rows, "COMERCIAL DIRETO");
    const prevDir = rowInSection(directSection, "Reuniões previstas");
    const realThiago = rowInSection(directSection, "Reuniões realizadas Thiago");
    const realGustavo = rowInSection(directSection, "Reuniões realizadas Gustavo");
    const realLeo = rowInSection(directSection, "Reuniões realizadas Leo");
    const fechThiago = rowInSection(directSection, "Qtd. fechamentos Thiago");
    const fechGustavo = rowInSection(directSection, "Qtd. fechamentos Gustavo");
    const fechLeo = rowInSection(directSection, "Qtd. fechamentos Leo");

    const scheduledTotal = parseInt0(prevDir?.[3]);
    const completedTotal =
      parseInt0(realThiago?.[3]) +
      parseInt0(realGustavo?.[3]) +
      parseInt0(realLeo?.[3]);

    const data: DashboardData = {
      salesGoal: { value: tcvValue, goal: 23800 },
      tcvGoal: { value: tcvValue, goal: 68000 },
      openValue: 0,
      openTcv: 0,
      marketing: {
        invested,
        mqls: mqlsValue,
        mqlsGoal: mqlsGoal || 40,
        cpmol: cpmqlValue,
        marketingSales: 0,
        roas: invested > 0 ? tcvValue / invested : 0,
      },
      funnel: [
        { stage: "Leads", value: leadCount },
        { stage: "MQLs", value: mqlsValue },
        { stage: "Reunião Agendada", value: raCount },
        { stage: "Reunião Realizada", value: rrCount },
      ],
      closers: [
        {
          name: "Leonardo",
          mrr: { value: 0, goal: 40000 },
          onboarding: { value: 0, goal: 40000 },
          total: { value: parseInt0(fechLeo?.[3]), goal: 23000 },
        },
        {
          name: "Gustavo",
          mrr: { value: 0, goal: 40000 },
          onboarding: { value: 0, goal: 40000 },
          total: { value: parseInt0(fechGustavo?.[3]), goal: 23000 },
        },
        {
          name: "Thiago",
          mrr: { value: 0, goal: 40000 },
          onboarding: { value: 0, goal: 40000 },
          total: { value: parseInt0(fechThiago?.[3]), goal: 23000 },
        },
      ],
      sdrs: [
        { name: "Ana Clara", scheduled: scheduledTotal, completed: completedTotal },
      ],
    };

    return data;
  },
);
