import { getGhlConfig } from "./config.server";
import { isCurrentMonthISO } from "./dashboard-data";

// ─── GoHighLevel (LeadConnector) funnel integration ─────────────────────────
// Pulls live opportunities from the CRM and builds the sales funnel.
// Cached for 1 hour so the outbound API request happens at most hourly,
// regardless of how often the dashboard is loaded/refreshed.

export interface GhlFunnel {
  stages: { stage: string; value: number }[];
  totalLeads: number;
  leadsThisMonth: number; // opportunities created in the current month (MQLs)
  negociacaoValue: number; // sum of monetaryValue of opps currently in "Negociação"
  wonValue: number;
  wonCount: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let cached: GhlFunnel | null = null;
let cachedAt = 0;

interface GhlStage {
  id: string;
  name: string;
  position: number;
}
interface GhlPipeline {
  id: string;
  name: string;
  stages: GhlStage[];
}
interface GhlOpportunity {
  pipelineId: string;
  pipelineStageId: string;
  status: string; // open | won | lost | abandoned
  monetaryValue: number | null;
  lastStageChangeAt?: string; // ISO date the opp entered its current stage
  createdAt?: string; // ISO date the opp was created
}


function ghlHeaders() {
  const cfg = getGhlConfig();
  return {
    Authorization: `Bearer ${cfg.token}`,
    Version: cfg.apiVersion,
    Accept: "application/json",
  };
}

async function fetchPipelines(): Promise<GhlPipeline[]> {
  const cfg = getGhlConfig();
  const url = `${cfg.baseUrl}/opportunities/pipelines?locationId=${cfg.locationId}`;
  const res = await fetch(url, { headers: ghlHeaders() });
  if (!res.ok) {
    console.error(`[GHL] pipelines failed: HTTP ${res.status}`);
    return [];
  }
  const json = (await res.json()) as { pipelines?: GhlPipeline[] };
  return json.pipelines ?? [];
}

async function fetchAllOpportunities(): Promise<GhlOpportunity[]> {
  const cfg = getGhlConfig();
  const all: GhlOpportunity[] = [];
  let url: string | null =
    `${cfg.baseUrl}/opportunities/search?location_id=${cfg.locationId}&limit=100`;
  let guard = 0;

  while (url && guard < 50) {
    guard++;
    const res: Response = await fetch(url, { headers: ghlHeaders() });
    if (!res.ok) {
      console.error(`[GHL] search failed: HTTP ${res.status}`);
      break;
    }
    const json = (await res.json()) as {
      opportunities?: GhlOpportunity[];
      meta?: { nextPageUrl?: string | null };
    };
    if (json.opportunities) all.push(...json.opportunities);
    url = json.meta?.nextPageUrl ?? null;
  }
  return all;
}

// Map a current pipeline-stage name to a funnel milestone level (0-4).
// Because the API only exposes the *current* stage, we infer the furthest
// milestone a lead has reached from where it currently sits on the won-path.
// Off-path stages (lost, no-response, pre-meeting) stay at level 0.
function milestoneLevel(stageName: string, status: string): number {
  if (status === "won") return 4;
  const e = stageName.toLowerCase();
  if (e.includes("ganha")) return 4;
  if (e.includes("negocia") || e.includes("aguardando") || e.includes("retorno de contato")) return 3;
  if (e.includes("realizada") || e.includes("/r2") || e.includes(" r2")) return 2;
  if (e.includes("agendada") || e.includes("no show")) return 1;
  return 0;
}

function buildFunnel(pipelines: GhlPipeline[], opps: GhlOpportunity[]): GhlFunnel {
  // Use the "Comercial" pipeline as the sales funnel source of truth.
  const comercial =
    pipelines.find((p) => p.name.toLowerCase().includes("comercial")) ?? pipelines[0];

  const stageById = new Map<string, GhlStage>();
  if (comercial) comercial.stages.forEach((s) => stageById.set(s.id, s));

  const inComercial = comercial
    ? opps.filter((o) => o.pipelineId === comercial.id)
    : opps;

  // Funnel reflects THIS MONTH's pipeline movement: opportunities that entered
  // their current stage during the current month (lastStageChangeAt).
  const thisMonth = inComercial.filter((o) => isCurrentMonthISO(o.lastStageChangeAt));

  let agendada = 0;
  let realizada = 0;
  let negociacao = 0;
  let ganha = 0;
  let wonValue = 0;
  let wonCount = 0;

  for (const o of thisMonth) {
    const stage = stageById.get(o.pipelineStageId);
    const level = milestoneLevel(stage?.name ?? "", o.status);
    if (level >= 1) agendada++;
    if (level >= 2) realizada++;
    if (level >= 3) negociacao++;
    if (level >= 4) ganha++;
    if (o.status === "won") {
      wonCount++;
      wonValue += o.monetaryValue ?? 0;
    }
  }

  // MQLs = leads created this month.
  const leadsThisMonth = inComercial.filter((o) => isCurrentMonthISO(o.createdAt)).length;

  // "Valor em Aberto" = total monetaryValue of opps currently in the
  // "Negociação" stage (a current snapshot, like the GHL pipeline view).
  let negociacaoValue = 0;
  for (const o of inComercial) {
    const stageName = (stageById.get(o.pipelineStageId)?.name ?? "").toLowerCase();
    if (stageName.includes("negocia")) negociacaoValue += o.monetaryValue ?? 0;
  }

  return {
    stages: [
      { stage: "Reunião Agendada", value: agendada },
      { stage: "Reunião Realizada", value: realizada },
      { stage: "Negociação", value: negociacao },
      { stage: "Venda Ganha", value: ganha },
    ],
    // Keep the full pipeline count for reference (not month-restricted).
    totalLeads: inComercial.length,
    leadsThisMonth,
    negociacaoValue,
    wonValue,
    wonCount,
    fetchedAt: Date.now(),
  };
}

/** Fetch the sales funnel from GHL, cached for 1 hour. */
export async function getGhlFunnel(): Promise<GhlFunnel | null> {
  if (cached && Date.now() - cachedAt < CACHE_TTL_MS) {
    console.log("[GHL] Funnel cache hit (age:", Math.round((Date.now() - cachedAt) / 1000), "s)");
    return cached;
  }

  console.log("[GHL] Fetching live opportunities from CRM...");
  try {
    const [pipelines, opps] = await Promise.all([
      fetchPipelines(),
      fetchAllOpportunities(),
    ]);
    if (pipelines.length === 0 || opps.length === 0) {
      console.error("[GHL] No data returned — keeping previous cache if any");
      return cached;
    }
    const funnel = buildFunnel(pipelines, opps);
    cached = funnel;
    cachedAt = Date.now();
    console.log(
      "[GHL] Funnel:", funnel.stages.map((s) => `${s.stage}=${s.value}`).join(", "),
      "| leadsMês:", funnel.leadsThisMonth, "| Negociação R$:", funnel.negociacaoValue,
      "| won:", funnel.wonCount, funnel.wonValue
    );
    return funnel;
  } catch (e) {
    console.error("[GHL] Fetch error:", e);
    return cached;
  }
}
