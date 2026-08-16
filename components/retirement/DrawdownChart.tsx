"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DrawdownRow } from "@/lib/finance/retirement";

export default function DrawdownChart({ rows }: { rows: DrawdownRow[] }) {
  const data = rows.map((r) => ({ age: r.age, Corpus: Math.round(r.corpusBalance) }));
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis dataKey="age" />
          <YAxis width={80} />
          <Tooltip />
          <Area type="monotone" dataKey="Corpus" stroke="#2563eb" fill="#bfdbfe" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
