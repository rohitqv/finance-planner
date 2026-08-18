"use client";
import { useId } from "react";
import InfoTip from "@/components/InfoTip";

export type NumberUnit = "₹" | "%";

// A labelled number input with an inline ₹ prefix or % suffix (kept out of
// the label text so labels stay short) and an optional hover tooltip for
// contextual detail.
export default function NumberField({
  label,
  value,
  unit,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  unit?: NumberUnit;
  step?: number;
  hint?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {label}
        </label>
        {hint ? <InfoTip text={hint} label={`About ${label}`} /> : null}
      </div>
      <div className="relative mt-1">
        {unit === "₹" ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-sm text-gray-500 dark:text-gray-400"
          >
            ₹
          </span>
        ) : null}
        <input
          id={id}
          aria-label={label}
          type="number"
          step={step}
          className={`w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors focus:border-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${
            unit === "₹" ? "pl-8" : ""
          } ${unit === "%" ? "pr-8" : ""}`}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {unit === "%" ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-gray-500 dark:text-gray-400"
          >
            %
          </span>
        ) : null}
      </div>
    </div>
  );
}
