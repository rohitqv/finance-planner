"use client";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { isBucketDrawdown, type DrawdownRow, type BucketDrawdownRow } from "@/lib/finance/retirement";
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

// Every chart here recomputes on each keystroke, so Recharts' default
// enter/update animation would have the drawn curve chasing the numbers by a
// second or so on every edit. Drawing straight to the new data keeps the
// chart and the figures beside it telling the same story at all times.

export default function DrawdownChart({ rows }: { rows: DrawdownRow[] | BucketDrawdownRow[] }) {
  if (isBucketDrawdown(rows)) {
    const data = rows.map((r) => ({
      age: r.age, "Growth bucket": Math.round(r.growthBalance), "Safe bucket": Math.round(r.safeBalance),
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
            <Line type="monotone" dataKey="Growth bucket" stroke="#16a34a" dot={false} strokeWidth={2} isAnimationActive={false} />
            <Line type="monotone" dataKey="Safe bucket" stroke="#d97706" dot={false} strokeWidth={2} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const data = rows.map((r) => ({ age: r.age, Corpus: Math.round(r.corpusBalance) }));
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
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
          <Area type="monotone" dataKey="Corpus" stroke="#2563eb" strokeWidth={2} fill="#bfdbfe" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
