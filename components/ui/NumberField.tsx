"use client";
import { useId, useState } from "react";
import InfoTip from "@/components/InfoTip";

export type NumberUnit = "₹" | "%";

// An emptied or half-typed box ("", "-", "1e") has no numeric meaning, so it
// parses to NaN and the validation layer reports "Enter a number".
// Deliberately *not* 0: that is a real value the user did not type, and the
// old `Number(e.target.value)` turned every backspace-to-empty into a silent
// zero that flowed straight into the projections.
export function parseFieldValue(draft: string): number {
  const trimmed = draft.trim();
  if (trimmed === "") return NaN;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toDraft(value: number): string {
  return Number.isFinite(value) ? String(value) : "";
}

// A labelled number input with an inline ₹ prefix or % suffix (kept out of
// the label text so labels stay short), an optional hover tooltip for
// contextual detail, and an inline validation message.
export default function NumberField({
  label,
  value,
  unit,
  step = 1,
  min,
  max,
  hint,
  error,
  onChange,
}: {
  label: string;
  value: number;
  unit?: NumberUnit;
  step?: number;
  min?: number;
  max?: number;
  hint?: string;
  error?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  // The box holds the raw keystrokes; the parent holds the parsed number.
  // Keeping them separate is what lets the field sit empty (or mid-edit at
  // "1.50") without the parent rewriting it under the cursor.
  const [draft, setDraft] = useState(() => toDraft(value));
  const [lastValue, setLastValue] = useState(value);
  if (!Object.is(value, lastValue)) {
    // Adjusting state during render (React's documented alternative to a
    // prop-sync effect) so an externally-changed value — a loaded scenario,
    // the retirement handoff — reaches the box before paint.
    setLastValue(value);
    // ...but only when the new value isn't just our own keystroke echoing
    // back. Object.is so a NaN we emitted for an empty box doesn't read as
    // a change and wipe the draft the user is still typing into.
    if (!Object.is(parseFieldValue(draft), value)) setDraft(toDraft(value));
  }

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
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          className={`w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 shadow-sm transition-colors dark:bg-gray-800 dark:text-gray-100 ${
            error
              ? "border-red-500 focus:border-red-500 dark:border-red-500"
              : "border-gray-300 focus:border-blue-500 dark:border-gray-600"
          } ${unit === "₹" ? "pl-8" : ""} ${unit === "%" ? "pr-8" : ""}`}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setLastValue(parseFieldValue(e.target.value));
            onChange(parseFieldValue(e.target.value));
          }}
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
      {error ? (
        <p id={errorId} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
