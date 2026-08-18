"use client";
import type { CalculatorInput } from "@/lib/finance/types";
import NumberField, { type NumberUnit } from "@/components/ui/NumberField";

type Field = { key: keyof CalculatorInput; label: string; unit?: NumberUnit; step?: number };

const sections: { title: string; fields: Field[] }[] = [
  {
    title: "Investments",
    fields: [
      { key: "lumpsum", label: "Lumpsum", unit: "₹" },
      { key: "monthlySip", label: "Monthly SIP", unit: "₹" },
    ],
  },
  {
    title: "Growth assumptions",
    fields: [
      { key: "stepUpPct", label: "Annual SIP step-up", unit: "%", step: 0.5 },
      { key: "annualReturn", label: "Expected annual return", unit: "%", step: 0.5 },
      { key: "years", label: "Duration (years)" },
      { key: "inflationPct", label: "Inflation", unit: "%", step: 0.5 },
    ],
  },
];

export default function InputPanel({
  value, onChange,
}: { value: CalculatorInput; onChange: (v: CalculatorInput) => void }) {
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
                step={f.step}
                value={value[f.key]}
                onChange={(v) => onChange({ ...value, [f.key]: v })}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
