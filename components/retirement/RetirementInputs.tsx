"use client";
import type { RetirementInput } from "@/lib/finance/retirement";
import AssetClassTable from "./AssetClassTable";
import NumberField, { type NumberUnit } from "@/components/ui/NumberField";
import InfoTip from "@/components/InfoTip";

type Field = {
  key: keyof RetirementInput;
  label: string;
  unit?: NumberUnit;
  hint?: string;
};

const sections: { title: string; fields: Field[] }[] = [
  {
    title: "Personal details",
    fields: [
      { key: "currentAge", label: "Current age" },
      { key: "retirementAge", label: "Retirement age" },
      { key: "lifespanAge", label: "Lifespan age" },
      { key: "currentMonthlyExpense", label: "Current monthly expense", unit: "₹" },
    ],
  },
  {
    title: "Growth assumptions",
    fields: [
      { key: "inflationPct", label: "Inflation", unit: "%" },
      { key: "preReturnPct", label: "Return on monthly investment / required SIP", unit: "%" },
      {
        key: "postReturnPct",
        label: "Post-retirement return",
        unit: "%",
        hint: "Applied as one blended rate to your whole retirement corpus during drawdown, regardless of which asset classes funded it. Ignored when bucket strategy is on, below.",
      },
      { key: "currentMonthlyInvestment", label: "Current monthly investment", unit: "₹" },
    ],
  },
];

const bucketFields: { key: keyof RetirementInput; label: string; unit?: NumberUnit }[] = [
  { key: "bucketYears", label: "Years of expense kept safe" },
  { key: "safeBucketRatePct", label: "Safe bucket rate", unit: "%" },
  { key: "growthBucketRatePct", label: "Growth bucket rate", unit: "%" },
];

export default function RetirementInputs({
  value, onChange,
}: { value: RetirementInput; onChange: (v: RetirementInput) => void }) {
  return (
    <div className="space-y-4">
      {sections.map((s) => (
        <section
          key={s.title}
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
        >
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {s.title}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {s.fields.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                unit={f.unit}
                hint={f.hint}
                value={value[f.key] as number}
                onChange={(v) => onChange({ ...value, [f.key]: v })}
              />
            ))}
          </div>
        </section>
      ))}

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Bucket strategy
        </h2>
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
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {bucketFields.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                unit={f.unit}
                value={value[f.key] as number}
                onChange={(v) => onChange({ ...value, [f.key]: v })}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="mb-3 flex items-center gap-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Asset classes
          </h2>
          <InfoTip
            label="About asset classes"
            text="Included assets are assumed fully liquid and available to fund retirement expenses. Excluded assets aren't counted in any total or calculation below."
          />
        </div>
        <AssetClassTable
          value={value.assetClasses}
          onChange={(assetClasses) => onChange({ ...value, assetClasses })}
        />
      </section>
    </div>
  );
}
