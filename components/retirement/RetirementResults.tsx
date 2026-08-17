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

type Card = { label: string; value: string; signed?: boolean; positive?: boolean };

export default function RetirementResults({
  result, invalidLifespan,
}: { result: RetirementResult; invalidLifespan?: boolean }) {
  if (invalidLifespan) {
    return (
      <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">
        Lifespan must be greater than retirement age. The ₹0 corpus and SIP
        figures a plan like this would otherwise show are not real results —
        adjust the ages to see the actual numbers.
      </div>
    );
  }
  const cards: Card[] = [
    { label: "Corpus needed (at retirement)", value: formatINR(result.corpusNeededAtRetirement) },
    { label: "Corpus target (today's value)", value: formatINR(result.corpusNeededToday) },
    { label: "Required monthly SIP", value: formatMoneyOrInfinite(result.requiredMonthlySip) },
    { label: "Projected from current plan", value: formatINR(result.projectedCorpusFromCurrentPlan) },
    {
      label: result.gap >= 0 ? "Shortfall" : "Surplus",
      value: formatINR(Math.abs(result.gap)),
      signed: true,
      positive: result.gap < 0,
    },
    { label: "Extra SIP to close gap", value: formatMoneyOrInfinite(result.extraSipToCloseGap) },
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
          <div className={`text-xs uppercase ${c.signed ? "opacity-70" : "text-gray-500"}`}>
            {c.label}
          </div>
          <div className="text-lg font-semibold">
            {c.signed && (
              <span aria-hidden="true" className="mr-1">
                {c.positive ? "▲" : "▼"}
              </span>
            )}
            <span>{c.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
