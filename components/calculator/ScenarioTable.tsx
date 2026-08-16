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
  if (scenarios.length === 0) return <p className="text-sm text-gray-500">No saved scenarios yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          <th>Name</th><th>FV</th><th>CAGR</th><th>XIRR</th><th></th>
        </tr>
      </thead>
      <tbody>
        {scenarios.map((s) => {
          const r = calculate(s);
          return (
            <tr key={s.id} className="border-t">
              <td className="py-1">
                <button className="text-blue-600 underline" onClick={() => onLoad(s)}>{s.name}</button>
              </td>
              <td>{formatINR(r.futureValue)}</td>
              <td>{formatPct(r.cagr)}</td>
              <td>{formatPct(r.xirr)}</td>
              <td className="space-x-2 text-right">
                <button className="text-gray-600" onClick={() => onDuplicate(s.id)}>Duplicate</button>
                <button className="text-red-600" onClick={() => onDelete(s.id)}>Delete</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
