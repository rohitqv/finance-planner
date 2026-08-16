"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { MonthlyPoint } from "@/lib/finance/types";

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
        <LineChart data={data}>
          <XAxis dataKey="age" />
          <YAxis width={80} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Required" stroke="#2563eb" dot={false} />
          {surplus ? <Line type="monotone" dataKey="Surplus" stroke="#16a34a" dot={false} /> : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
