"use client";
import type { ExpensePhase } from "@/lib/finance/retirement";

export default function PhaseEditor({
  phases, onChange,
}: { phases: ExpensePhase[]; onChange: (p: ExpensePhase[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Life-phase expenses (optional)</span>
        <button
          className="text-sm text-blue-600"
          onClick={() => onChange([...phases, { fromAge: 70, toAge: 85, monthlyExpenseToday: 30000 }])}
        >
          + Add phase
        </button>
      </div>
      {phases.map((p, idx) => (
        <div key={idx} className="flex gap-2">
          {(["fromAge", "toAge", "monthlyExpenseToday"] as const).map((k) => (
            <input
              key={k}
              aria-label={`phase ${idx} ${k}`}
              type="number"
              className="w-full rounded border px-2 py-1 text-sm"
              value={p[k]}
              onChange={(e) => {
                const next = [...phases];
                next[idx] = { ...p, [k]: Number(e.target.value) };
                onChange(next);
              }}
            />
          ))}
          <button className="text-red-600" onClick={() => onChange(phases.filter((_, i) => i !== idx))}>×</button>
        </div>
      ))}
    </div>
  );
}
