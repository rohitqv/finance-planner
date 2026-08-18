"use client";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { isBucketDrawdown, type DrawdownRow, type BucketDrawdownRow } from "@/lib/finance/retirement";

export default function DrawdownChart({ rows }: { rows: DrawdownRow[] | BucketDrawdownRow[] }) {
  if (isBucketDrawdown(rows)) {
    const data = rows.map((r) => ({
      age: r.age, "Growth bucket": Math.round(r.growthBalance), "Safe bucket": Math.round(r.safeBalance),
    }));
    return (
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="age" />
            <YAxis width={80} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Growth bucket" stroke="#16a34a" dot={false} />
            <Line type="monotone" dataKey="Safe bucket" stroke="#d97706" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
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
