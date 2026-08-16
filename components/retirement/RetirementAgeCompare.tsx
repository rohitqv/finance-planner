"use client";
import { computeRetirement, type RetirementInput } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

// requiredMonthlySip can legitimately be Infinity when a candidate retirement
// age leaves zero (or near-zero) years to accumulate via SIP — see
// lib/finance/retirement.ts and the same guard in RetirementResults.tsx.
// formatINR(Infinity) would render "₹∞", which reads as a broken number
// rather than an intentional "not achievable" result, so render it as text
// instead.
function formatMoneyOrInfinite(value: number): string {
  return Number.isFinite(value) ? formatINR(value) : "Not achievable in 0 years";
}

export default function RetirementAgeCompare({
  base, ages,
}: { base: RetirementInput; ages: number[] }) {
  const cols = ages.map((age) => ({ age, result: computeRetirement({ ...base, retirementAge: age }) }));
  const rows: { label: string; get: (r: ReturnType<typeof computeRetirement>) => string }[] = [
    { label: "Corpus needed (at retirement)", get: (r) => formatINR(r.corpusNeededAtRetirement) },
    { label: "Required monthly SIP", get: (r) => formatMoneyOrInfinite(r.requiredMonthlySip) },
    { label: "Corpus needed (today's value)", get: (r) => formatINR(r.corpusNeededToday) },
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          <th></th>
          {cols.map((c) => <th key={c.age}>{`Retire @ ${c.age}`}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t">
            <td className="py-1 text-gray-600">{row.label}</td>
            {cols.map((c) => <td key={c.age}>{row.get(c.result)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
