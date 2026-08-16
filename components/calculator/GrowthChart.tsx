"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import type { MonthlyPoint } from "@/lib/finance/types";

export default function GrowthChart({ series, goal }: { series: MonthlyPoint[]; goal?: number }) {
  const data = series.map((p) => ({ year: p.month / 12, Invested: Math.round(p.invested), Value: Math.round(p.value) }));
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="year" />
          <YAxis width={80} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Invested" stroke="#94a3b8" dot={false} />
          <Line type="monotone" dataKey="Value" stroke="#2563eb" dot={false} />
          {goal ? <ReferenceLine y={goal} stroke="#dc2626" strokeDasharray="4 4" label="Goal" /> : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
