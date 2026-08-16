"use client";
import type { CalculatorInput } from "@/lib/finance/types";

const fields: { key: keyof CalculatorInput; label: string; step?: number }[] = [
  { key: "lumpsum", label: "Lumpsum (₹)" },
  { key: "monthlySip", label: "Monthly SIP (₹)" },
  { key: "stepUpPct", label: "Annual SIP step-up (%)", step: 0.5 },
  { key: "annualReturn", label: "Expected annual return (%)", step: 0.5 },
  { key: "years", label: "Duration (years)" },
  { key: "inflationPct", label: "Inflation (%)", step: 0.5 },
];

export default function InputPanel({
  value, onChange,
}: { value: CalculatorInput; onChange: (v: CalculatorInput) => void }) {
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-sm text-gray-600">{f.label}</span>
          <input
            aria-label={f.label}
            type="number"
            step={f.step ?? 1}
            className="mt-1 w-full rounded border px-3 py-2"
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}
