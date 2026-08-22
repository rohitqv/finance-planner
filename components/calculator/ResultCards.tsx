"use client";
import type { CalculatorResult } from "@/lib/finance/types";
import { formatINR, formatMultiple, formatPct } from "@/lib/finance/format";
import InfoTip from "@/components/InfoTip";

type Card = {
  label: string; value: string; signed?: boolean; positive?: boolean; info?: string;
};

export default function ResultCards({ result }: { result: CalculatorResult }) {
  const secondary: Card[] = [
    { label: "Total Invested", value: formatINR(result.totalInvested) },
    {
      label: "Gain",
      value: formatINR(Math.abs(result.gain)),
      signed: true,
      positive: result.gain >= 0,
    },
    // Deliberately neutral rather than red/green: a multiple below 1x is
    // already reported as a loss by the Gain card above, and "▼ 0.90x" reads
    // as a falling rate rather than as money that shrank.
    {
      label: "Growth Multiple",
      value: formatMultiple(result.growthMultiple),
      info: "How many times over your invested money grew — total value divided by total invested. Not a yearly rate; see XIRR for that.",
    },
    {
      label: "XIRR",
      value: formatPct(Math.abs(result.xirr)),
      signed: true,
      positive: result.xirr >= 0,
      info: "Your annualized return, accounting for when each instalment was actually invested. This is the figure to compare against a quoted fund return.",
    },
    { label: "Inflation-adjusted FV", value: formatINR(result.inflationAdjustedFV) },
  ];
  return (
    <div className="space-y-4">
      {/* Hero metric — the headline number everything else supports. */}
      <div
        data-card="Future Value"
        className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4 shadow-sm dark:border-blue-800 dark:bg-blue-950"
      >
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Future Value
        </div>
        <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">
          {formatINR(result.futureValue)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {secondary.map((c) => (
          <div
            key={c.label}
            data-card={c.label}
            className={
              c.signed
                ? `rounded-xl p-4 shadow-sm ${c.positive ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"}`
                : "rounded-xl border border-gray-200 p-4 shadow-sm dark:border-gray-700"
            }
          >
            <div
              className={`flex items-center gap-1 text-xs uppercase ${c.signed ? "" : "text-gray-500 dark:text-gray-400"}`}
            >
              <span>{c.label}</span>
              {c.info && <InfoTip text={c.info} label={`About ${c.label}`} />}
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
    </div>
  );
}
