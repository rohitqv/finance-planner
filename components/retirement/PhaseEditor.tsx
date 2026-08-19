"use client";
import type { ExpensePhase } from "@/lib/finance/retirement";
import { parseFieldValue } from "@/components/ui/NumberField";
import { validatePhases } from "@/lib/finance/validation";

const COLUMNS: { key: keyof ExpensePhase; label: string; unit?: string }[] = [
  { key: "fromAge", label: "From age" },
  { key: "toAge", label: "To age" },
  { key: "monthlyExpenseToday", label: "Monthly expense (today's ₹)", unit: "₹" },
];

export default function PhaseEditor({
  phases, onChange,
}: { phases: ExpensePhase[]; onChange: (p: ExpensePhase[]) => void }) {
  // Phase problems are cross-field by nature (a range inverted, two ranges
  // overlapping), so they're listed under the editor rather than pinned to
  // one box — but they're the same checks the results panel gates on, shown
  // here next to the inputs that cause them.
  const errors = validatePhases(phases);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Life-phase expenses (optional)</span>
        <button
          type="button"
          className="text-sm text-blue-600 dark:text-blue-400"
          onClick={() => {
            // Start the new phase after the last one ends, so adding two in a
            // row can't silently produce the overlap the validator rejects.
            const lastEnd = phases.reduce(
              (max, p) => (Number.isFinite(p.toAge) ? Math.max(max, p.toAge) : max), 0);
            const fromAge = lastEnd > 0 ? lastEnd + 1 : 70;
            onChange([...phases, { fromAge, toAge: fromAge + 15, monthlyExpenseToday: 30000 }]);
          }}
        >
          + Add phase
        </button>
      </div>

      {phases.length > 0 ? (
        <div className="grid grid-cols-[1fr_1fr_2fr_auto] gap-2 text-xs text-gray-500 dark:text-gray-400">
          {COLUMNS.map((c) => (
            <span key={c.key}>{c.label}</span>
          ))}
          <span className="sr-only">Remove</span>
        </div>
      ) : null}

      {phases.map((p, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_2fr_auto] items-center gap-2">
          {COLUMNS.map((c) => (
            <input
              key={c.key}
              aria-label={`Phase ${idx + 1} ${c.label}`}
              type="number"
              inputMode="decimal"
              min={0}
              className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              value={Number.isFinite(p[c.key]) ? p[c.key] : ""}
              onChange={(e) => {
                const next = [...phases];
                next[idx] = { ...p, [c.key]: parseFieldValue(e.target.value) };
                onChange(next);
              }}
            />
          ))}
          <button
            type="button"
            aria-label={`Remove phase ${idx + 1}`}
            className="px-1 text-red-600 dark:text-red-400"
            onClick={() => onChange(phases.filter((_, i) => i !== idx))}
          >
            ×
          </button>
        </div>
      ))}

      {errors.length > 0 ? (
        <ul role="alert" className="list-disc space-y-0.5 pl-5 text-xs text-red-600 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
