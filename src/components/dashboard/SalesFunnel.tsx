interface Stage { stage: string; value: number; }

export function SalesFunnel({ stages }: { stages: Stage[] }) {
  const max = Math.max(...stages.map((s) => s.value));
  const shades = [
    "oklch(0.32 0.13 260)",
    "oklch(0.46 0.18 256)",
    "oklch(0.62 0.2 250)",
    "oklch(0.78 0.16 225)",
  ];

  return (
    <div className="glass rounded-2xl p-5 h-full flex flex-col">
      <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-4">Funil de Vendas</h3>
      <div className="flex-1 flex flex-col justify-center gap-2">
        {stages.map((s, i) => {
          const w = max > 0 ? 42 + (s.value / max) * 46 : 42;
          return (
            <div key={s.stage} className="flex items-center justify-center">
              <div
                className="relative flex items-center justify-between gap-3 pl-8 pr-12 py-3 rounded-md font-display font-semibold transition-all"
                style={{
                  width: `${w}%`,
                  background: shades[i] ?? shades[shades.length - 1],
                  clipPath: "polygon(2% 0, 98% 0, 95% 100%, 5% 100%)",
                  boxShadow: "0 4px 14px oklch(0.1 0.05 260 / 0.6)",
                }}
              >
                <span className="text-xs sm:text-sm text-foreground/90">{s.stage}</span>
                <span className="text-lg sm:text-xl font-bold tabular-nums">{s.value}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
