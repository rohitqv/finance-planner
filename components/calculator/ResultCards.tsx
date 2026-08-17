"use client";
import type { CalculatorResult } from "@/lib/finance/types";
import { formatINR, formatPct } from "@/lib/finance/format";

type Card = { label: string; value: string; signed?: boolean; positive?: boolean };

export default function ResultCards({ result }: { result: CalculatorResult }) {
  const cards: Card[] = [
    { label: "Future Value", value: formatINR(result.futureValue) },
    { label: "Total Invested", value: formatINR(result.totalInvested) },
    {
      label: "Gain",
      value: formatINR(Math.abs(result.gain)),
      signed: true,
      positive: result.gain >= 0,
    },
    {
      label: "CAGR",
      value: formatPct(Math.abs(result.cagr)),
      signed: true,
      positive: result.cagr >= 0,
    },
    {
      label: "XIRR",
      value: formatPct(Math.abs(result.xirr)),
      signed: true,
      positive: result.xirr >= 0,
    },
    { label: "Inflation-adjusted FV", value: formatINR(result.inflationAdjustedFV) },
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            c.signed
              ? `rounded-xl p-4 shadow-sm ${c.positive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`
              : "rounded-xl border p-4 shadow-sm"
          }
        >
          <div className={`text-xs uppercase ${c.signed ? "" : "text-gray-500"}`}>
            {c.label}
          </div>
          <div className="text-lg font-semibold">
            {c.signed && (
              <span aria-hidden="true" className="mr-1">
                {c.positive ? "▲" : "▼"}
              </span>
            )}
            {c.signed && !c.positive && <span className="sr-only">negative </span>}
            <span>{c.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
