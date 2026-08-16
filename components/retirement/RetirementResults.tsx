"use client";
import type { RetirementResult } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

// requiredMonthlySip / extraSipToCloseGap can legitimately be Infinity (e.g.
// currentAge === retirementAge leaves no time for a SIP to accumulate — see
// lib/finance/retirement.ts). formatINR(Infinity) would render "₹∞", which
// reads as a broken number rather than an intentional "not achievable"
// result, so render it as text instead.
function formatMoneyOrInfinite(value: number): string {
  return Number.isFinite(value) ? formatINR(value) : "Not achievable in 0 years";
}

export default function RetirementResults({ result }: { result: RetirementResult }) {
  const cards = [
    { label: "Corpus needed (at retirement)", value: formatINR(result.corpusNeededAtRetirement) },
    { label: "Corpus target (today's value)", value: formatINR(result.corpusNeededToday) },
    { label: "Required monthly SIP", value: formatMoneyOrInfinite(result.requiredMonthlySip) },
    { label: "Projected from current plan", value: formatINR(result.projectedCorpusFromCurrentPlan) },
    { label: result.gap >= 0 ? "Shortfall" : "Surplus", value: formatINR(Math.abs(result.gap)) },
    { label: "Extra SIP to close gap", value: formatMoneyOrInfinite(result.extraSipToCloseGap) },
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
