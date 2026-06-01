import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, CartesianGrid } from "recharts";
import type { SdrStats } from "@/lib/dashboard-data";

export function SdrMeetings({ sdrs }: { sdrs: SdrStats[] }) {
  const data = sdrs.map((s) => ({ name: s.name, Agendadas: s.scheduled, Realizadas: s.completed }));
  return (
    <div className="glass rounded-2xl p-5 h-full flex flex-col">
      <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-4">Reuniões por SDR</h3>
      <div className="flex-1 min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 16, right: 16, top: 8, bottom: 8 }}>
            <defs>
              <linearGradient id="bar-scheduled" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="oklch(0.32 0.13 260)" />
                <stop offset="100%" stopColor="oklch(0.5 0.2 258)" />
              </linearGradient>
              <linearGradient id="bar-completed" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="oklch(0.6 0.18 235)" />
                <stop offset="100%" stopColor="oklch(0.85 0.15 210)" />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="oklch(0.3 0.05 258 / 0.4)" horizontal={false} />
            <XAxis type="number" stroke="oklch(0.7 0.03 250)" fontSize={11} />
            <YAxis dataKey="name" type="category" stroke="oklch(0.85 0.02 250)" fontSize={13} width={80} />
            <Tooltip
              cursor={{ fill: "oklch(0.3 0.06 258 / 0.3)" }}
              contentStyle={{
                background: "oklch(0.18 0.05 260)",
                border: "1px solid oklch(0.5 0.18 256 / 0.4)",
                borderRadius: 10,
                color: "white",
              }}
            />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
            <Bar dataKey="Agendadas" fill="url(#bar-scheduled)" radius={[0, 6, 6, 0]} barSize={22} />
            <Bar dataKey="Realizadas" fill="url(#bar-completed)" radius={[0, 6, 6, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
