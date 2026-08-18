"use client";
import type { Scenario } from "@/store/scenarios";
import { calculate } from "@/lib/finance/calculate";
import { formatINR, formatPct } from "@/lib/finance/format";

export default function ScenarioTable({
  scenarios, onDelete, onDuplicate, onLoad,
}: {
  scenarios: Scenario[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLoad: (s: Scenario) => void;
}) {
  if (scenarios.length === 0) return <p className="text-sm text-gray-500 dark:text-gray-400">No saved scenarios yet.</p>;
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">FV</th>
            <th className="px-3 py-2">CAGR</th>
            <th className="px-3 py-2">XIRR</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {scenarios.map((s) => {
            const r = calculate(s);
            return (
              <tr key={s.id} className="border-t transition-colors first:border-t-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <td className="px-3 py-2">
                  <button
                    className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    onClick={() => onLoad(s)}
                  >
                    {s.name}
                  </button>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {formatINR(s.monthlySip)}/mo · {s.years}y · {formatPct(s.annualReturn / 100)}
                  </div>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatINR(r.futureValue)}</td>
                <td className="px-3 py-2 tabular-nums">{formatPct(r.cagr)}</td>
                <td className="px-3 py-2 tabular-nums">{formatPct(r.xirr)}</td>
                <td className="space-x-3 px-3 py-2 text-right">
                  <button className="text-gray-500 transition-colors hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200" onClick={() => onDuplicate(s.id)}>
                    Duplicate
                  </button>
                  <button className="text-red-500 transition-colors hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" onClick={() => onDelete(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
