"use client";
import type { ReactNode } from "react";
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

function SecondaryCard({ c }: { c: Card }) {
  return (
    <div
      className={
        c.signed
          ? `rounded-xl p-4 shadow-sm ${c.positive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`
          : "rounded-xl border p-4 shadow-sm"
      }
    >
      <div className={`text-xs uppercase ${c.signed ? "" : "text-gray-500"}`}>{c.label}</div>
      <div className="text-lg font-semibold">
        {c.signed && (
          <span aria-hidden="true" className="mr-1">
            {c.positive ? "▲" : "▼"}
          </span>
        )}
        <span>{c.value}</span>
      </div>
    </div>
  );
}

function PrimaryCard({ c, action }: { c: Card; action?: ReactNode }) {
  return (
    <div
      className={
        c.signed
          ? `rounded-xl border-2 p-4 shadow-md ${
              c.positive ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"
            }`
          : "rounded-xl border-2 border-gray-300 p-4 shadow-md"
      }
    >
      <div className={`text-xs uppercase ${c.signed ? "" : "text-gray-500"}`}>{c.label}</div>
      <div className="mt-1 text-xl font-bold">
        {c.signed && (
          <span aria-hidden="true" className="mr-1">
            {c.positive ? "▲" : "▼"}
          </span>
        )}
        <span>{c.value}</span>
      </div>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export default function RetirementResults({
  result, invalidLifespan, action,
}: {
  result: RetirementResult;
  invalidLifespan?: boolean;
  // Optional next-step CTA rendered inside the primary Shortfall/Surplus card
  // (e.g. the "Plan this in Calculator" handoff button).
  action?: ReactNode;
}) {
  if (invalidLifespan) {
    return (
      <div className="rounded-xl border border-red-400 bg-red-50 p-4 shadow-sm text-sm text-red-700">
        Lifespan must be greater than retirement age. The ₹0 corpus and SIP
        figures a plan like this would otherwise show are not real results —
        adjust the ages to see the actual numbers.
      </div>
    );
  }

  const secondary: Card[] = [
    { label: "Corpus needed (at retirement)", value: formatINR(result.corpusNeededAtRetirement) },
    { label: "Corpus target (today's value)", value: formatINR(result.corpusNeededToday) },
    { label: "Projected from current plan", value: formatINR(result.projectedCorpusFromCurrentPlan) },
    { label: "Extra SIP to close gap", value: formatMoneyOrInfinite(result.extraSipToCloseGap) },
  ];
  const primary: Card[] = [
    { label: "Required monthly SIP", value: formatMoneyOrInfinite(result.requiredMonthlySip) },
    {
      label: result.gap >= 0 ? "Shortfall" : "Surplus",
      value: formatINR(Math.abs(result.gap)),
      signed: true,
      positive: result.gap < 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <SecondaryCard c={secondary[0]} />
        <SecondaryCard c={secondary[1]} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <PrimaryCard c={primary[0]} />
        <PrimaryCard c={primary[1]} action={action} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <SecondaryCard c={secondary[2]} />
        <SecondaryCard c={secondary[3]} />
      </div>
    </div>
  );
}
