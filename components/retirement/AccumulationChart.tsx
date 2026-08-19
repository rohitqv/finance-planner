"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

const AXIS_TICK = { fontSize: 12, fill: "var(--chart-axis-text)" };

export default function AccumulationChart({
  required, surplus, startAge,
}: { required: MonthlyPoint[]; surplus: MonthlyPoint[] | null; startAge: number }) {
  const data = required.map((r, i) => ({
    age: startAge + i + 1,
    Required: Math.round(r.value),
    ...(surplus ? { Surplus: Math.round(surplus[i].value) } : {}),
  }));
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis dataKey="age" tick={AXIS_TICK} />
          <YAxis
            width={76}
            tickFormatter={(v) => formatCompactINR(Number(v))}
            tick={AXIS_TICK}
          />
          <Tooltip
            formatter={(value) => formatINR(Number(value))}
            labelFormatter={(v) => `Age ${v}`}
            cursor={{ stroke: "var(--chart-cursor)", strokeDasharray: "4 4" }}
            contentStyle={TOOLTIP_STYLE}
          />
          <Legend verticalAlign="top" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="Required" stroke="#2563eb" dot={false} strokeWidth={2} isAnimationActive={false} />
          {surplus ? <Line type="monotone" dataKey="Surplus" stroke="#16a34a" dot={false} strokeWidth={2} isAnimationActive={false} /> : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
