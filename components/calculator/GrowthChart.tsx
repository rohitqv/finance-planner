"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import type { MonthlyPoint } from "@/lib/finance/types";
import { formatINR, formatCompactINR } from "@/lib/finance/format";

const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid var(--chart-tooltip-border)",
  background: "var(--chart-tooltip-bg)",
  color: "var(--foreground)",
  fontSize: 12,
  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
} as const;

export default function GrowthChart({ series, goal }: { series: MonthlyPoint[]; goal?: number }) {
  const data = series.map((p) => ({ year: p.month / 12, Invested: Math.round(p.invested), Value: Math.round(p.value) }));
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="year" tickFormatter={(v) => `${v}y`} tick={{ fontSize: 12, fill: "var(--chart-axis-text)" }} />
          <YAxis
            width={76}
            tickFormatter={(v) => formatCompactINR(Number(v))}
            tick={{ fontSize: 12, fill: "var(--chart-axis-text)" }}
          />
          <Tooltip
            formatter={(value) => formatINR(Number(value))}
            labelFormatter={(v) => `Year ${v}`}
            cursor={{ stroke: "var(--chart-cursor)", strokeDasharray: "4 4" }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Invested" stroke="#94a3b8" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Value" stroke="#2563eb" dot={false} strokeWidth={2} />
          {goal ? (
            <ReferenceLine
              y={goal}
              stroke="#dc2626"
              strokeDasharray="4 4"
              label={{ value: "Goal", position: "insideTopRight", fill: "#dc2626", fontSize: 12 }}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
