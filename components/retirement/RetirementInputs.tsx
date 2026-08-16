"use client";
import type { RetirementInput } from "@/lib/finance/retirement";

const numFields: { key: keyof RetirementInput; label: string }[] = [
  { key: "currentAge", label: "Current age" },
  { key: "retirementAge", label: "Retirement age" },
  { key: "lifespanAge", label: "Lifespan age" },
  { key: "currentMonthlyExpense", label: "Current monthly expense (₹)" },
  { key: "inflationPct", label: "Inflation (%)" },
  { key: "preReturnPct", label: "Pre-retirement return (%)" },
  { key: "postReturnPct", label: "Post-retirement return (%)" },
  { key: "currentCorpus", label: "Current corpus (₹)" },
  { key: "currentMonthlyInvestment", label: "Current monthly investment (₹)" },
];

export default function RetirementInputs({
  value, onChange,
}: { value: RetirementInput; onChange: (v: RetirementInput) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {numFields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-sm text-gray-600">{f.label}</span>
          <input
            aria-label={f.label}
            type="number"
            className="mt-1 w-full rounded border px-3 py-2"
            value={value[f.key] as number}
            onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}
