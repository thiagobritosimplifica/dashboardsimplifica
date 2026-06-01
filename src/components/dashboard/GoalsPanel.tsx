import { Settings } from "lucide-react";
import { useState, useEffect } from "react";

export type GoalsConfig = {
  salesGoal: number;
  tcvGoal: number;
  mqlsGoal: number;
  closerMrrGoal: number;
  closerOnboardingGoal: number;
  closerTotalGoal: number;
};

const DEFAULT_GOALS: GoalsConfig = {
  salesGoal: 235000,
  tcvGoal: 750000,
  mqlsGoal: 400,
  closerMrrGoal: 40000,
  closerOnboardingGoal: 40000,
  closerTotalGoal: 23000,
};

const STORAGE_KEY = "simplifica-goals";

export function loadGoals(): GoalsConfig {
  if (typeof window === "undefined") return DEFAULT_GOALS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GOALS;
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
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

            {/* Metas por Closer */}
            <div>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground font-display mb-3">
                Metas por Closer
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <GoalInput
                  label="Meta MRR"
                  value={goals.closerMrrGoal}
                  onChange={(v) => updateField("closerMrrGoal", v)}
                  prefix="R$"
                />
                <GoalInput
                  label="Meta Onboarding"
                  value={goals.closerOnboardingGoal}
                  onChange={(v) => updateField("closerOnboardingGoal", v)}
                  prefix="R$"
                />
                <GoalInput
                  label="Meta Total"
                  value={goals.closerTotalGoal}
                  onChange={(v) => updateField("closerTotalGoal", v)}
                  prefix="R$"
                />
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
