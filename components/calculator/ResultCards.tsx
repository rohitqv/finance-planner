"use client";
import type { CalculatorResult } from "@/lib/finance/types";
import { formatINR, formatPct } from "@/lib/finance/format";

export default function ResultCards({ result }: { result: CalculatorResult }) {
  const cards: { label: string; value: string }[] = [
    { label: "Future Value", value: formatINR(result.futureValue) },
    { label: "Total Invested", value: formatINR(result.totalInvested) },
    { label: "Gain", value: formatINR(result.gain) },
    { label: "CAGR", value: formatPct(result.cagr) },
    { label: "XIRR", value: formatPct(result.xirr) },
    { label: "Inflation-adjusted FV", value: formatINR(result.inflationAdjustedFV) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded border p-3">
          <div className="text-xs uppercase text-gray-500">{c.label}</div>
          <div className="text-lg font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
