import { Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { CLOSERS } from "@/lib/dashboard-data";

export type CloserGoal = { vendasGoal: number; tcvGoal: number };

export type GoalsConfig = {
  salesGoal: number;
  tcvGoal: number;
  mqlsGoal: number;
  // Fallback defaults for closers without an explicit per-closer goal.
  closerVendasGoal: number;
  closerTcvGoal: number;
  // Per-closer goals, keyed by closer name.
  closerGoals: Record<string, CloserGoal>;
};

const DEFAULT_CLOSER_VENDAS = 23000;
const DEFAULT_CLOSER_TCV = 50000;

const DEFAULT_GOALS: GoalsConfig = {
  salesGoal: 235000,
  tcvGoal: 750000,
  mqlsGoal: 400,
  closerVendasGoal: DEFAULT_CLOSER_VENDAS,
  closerTcvGoal: DEFAULT_CLOSER_TCV,
  closerGoals: Object.fromEntries(
    CLOSERS.map((name) => [name, { vendasGoal: DEFAULT_CLOSER_VENDAS, tcvGoal: DEFAULT_CLOSER_TCV }])
  ),
};

const STORAGE_KEY = "simplifica-goals";

export function loadGoals(): GoalsConfig {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GOALS;
    const parsed = JSON.parse(raw) as Partial<GoalsConfig>;
    return {
      ...DEFAULT_GOALS,
      ...parsed,
      // Deep-merge closer goals so the canonical roster always has entries.
      closerGoals: { ...DEFAULT_GOALS.closerGoals, ...(parsed.closerGoals ?? {}) },
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

function saveGoals(goals: GoalsConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(goals));
}

function formatInputBRL(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

function parseInputBRL(value: string): number {
  const cleaned = value.replace(/[^\d]/g, "");
  return parseInt(cleaned, 10) || 0;
}

export function GoalsPanel({ onSave }: { onSave: (goals: GoalsConfig) => void }) {
  const [open, setOpen] = useState(false);
  const [goals, setGoals] = useState<GoalsConfig>(DEFAULT_GOALS);

  useEffect(() => {
    setGoals(loadGoals());
  }, []);

  const handleSave = () => {
    saveGoals(goals);
    onSave(goals);
    setOpen(false);
  };

  const updateField = (field: keyof GoalsConfig, value: string) => {
    setGoals((prev) => ({ ...prev, [field]: parseInputBRL(value) }));
  };

  const updateCloserGoal = (name: string, field: keyof CloserGoal, value: string) => {
    setGoals((prev) => ({
      ...prev,
      closerGoals: {
        ...prev.closerGoals,
        [name]: {
          ...(prev.closerGoals[name] ?? { vendasGoal: prev.closerVendasGoal, tcvGoal: prev.closerTcvGoal }),
          [field]: parseInputBRL(value),
        },
      },
    }));
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="glass rounded-lg p-2 hover:bg-secondary/40 transition-colors"
        title="Configurar Metas"
      >
        <Settings size={16} />
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto border border-border shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold">⚙️ Configurar Metas</h2>
            <button
              onClick={() => setOpen(false)}
              className="glass rounded-lg p-2 hover:bg-secondary/40 transition-colors text-muted-foreground"
            >
              ✕
            </button>
          </div>

          <div className="space-y-5">
            {/* Metas Gerais */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-3">
                Metas Gerais
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <GoalInput
                  label="Meta de Vendas"
                  value={goals.salesGoal}
                  onChange={(v) => updateField("salesGoal", v)}
                  prefix="R$"
                />
                <GoalInput
                  label="Meta de TCV"
                  value={goals.tcvGoal}
                  onChange={(v) => updateField("tcvGoal", v)}
                  prefix="R$"
                />
                <GoalInput
                  label="Meta de MQLs"
                  value={goals.mqlsGoal}
                  onChange={(v) => updateField("mqlsGoal", v)}
                />
              </div>
            </div>

            {/* Metas por Closer (individuais) */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-3">
                Metas por Closer
              </h3>
              <div className="space-y-4">
                {CLOSERS.map((name) => {
                  const cg = goals.closerGoals[name] ?? {
                    vendasGoal: goals.closerVendasGoal,
                    tcvGoal: goals.closerTcvGoal,
                  };
                  return (
                    <div key={name}>
                      <div className="text-sm font-display font-semibold mb-2">{name}</div>
                      <div className="grid grid-cols-2 gap-3">
                        <GoalInput
                          label="Meta de Vendas"
                          value={cg.vendasGoal}
                          onChange={(v) => updateCloserGoal(name, "vendasGoal", v)}
                          prefix="R$"
                        />
                        <GoalInput
                          label="Meta de TCV"
                          value={cg.tcvGoal}
                          onChange={(v) => updateCloserGoal(name, "tcvGoal", v)}
                          prefix="R$"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setOpen(false)}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium glass hover:bg-secondary/40 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all text-white"
              style={{ background: "var(--gradient-blue)", boxShadow: "var(--shadow-glow)" }}
            >
              Salvar Metas
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function GoalInput({
  label,
  value,
  onChange,
  prefix,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  prefix?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          type="text"
          value={formatInputBRL(value)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg bg-secondary/40 border border-border px-3 py-2 text-sm font-display tabular-nums focus:outline-none focus:ring-2 focus:ring-cyan/40 transition-all"
          style={{ paddingLeft: prefix ? "2rem" : "0.75rem" }}
        />
      </div>
    </div>
  );
}
