"use client";
import type { RetirementInput } from "@/lib/finance/retirement";
import AssetClassTable from "./AssetClassTable";

const numFields: { key: keyof RetirementInput; label: string; hint?: string }[] = [
  { key: "currentAge", label: "Current age" },
  { key: "retirementAge", label: "Retirement age" },
  { key: "lifespanAge", label: "Lifespan age" },
  { key: "currentMonthlyExpense", label: "Current monthly expense (₹)" },
  { key: "inflationPct", label: "Inflation (%)" },
  { key: "preReturnPct", label: "Return on monthly investment / required SIP (%)" },
  {
    key: "postReturnPct", label: "Post-retirement return (%)",
    hint: "Applied as one blended rate to your whole retirement corpus during drawdown, regardless of which asset classes funded it. Ignored when bucket strategy is on, below.",
  },
  { key: "currentMonthlyInvestment", label: "Current monthly investment (₹)" },
];

const bucketFields: { key: keyof RetirementInput; label: string }[] = [
  { key: "bucketYears", label: "Years of expense kept safe" },
  { key: "safeBucketRatePct", label: "Safe bucket rate (%)" },
  { key: "growthBucketRatePct", label: "Growth bucket rate (%)" },
];

export default function RetirementInputs({
  value, onChange,
}: { value: RetirementInput; onChange: (v: RetirementInput) => void }) {
  return (
    <div className="space-y-4">
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
            {f.hint ? <span className="mt-1 block text-xs text-gray-500">{f.hint}</span> : null}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          aria-label="Use bucket strategy for drawdown"
          type="checkbox"
          checked={value.useBucketStrategy}
          onChange={(e) => onChange({ ...value, useBucketStrategy: e.target.checked })}
        />
        Use bucket strategy for drawdown
      </label>
      {value.useBucketStrategy ? (
        <div className="grid grid-cols-3 gap-3">
          {bucketFields.map((f) => (
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
      ) : null}
      <AssetClassTable
        value={value.assetClasses}
        onChange={(assetClasses) => onChange({ ...value, assetClasses })}
      />
    </div>
  );
}
