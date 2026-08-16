"use client";
import type { DrawdownRow } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function DrawdownTable({ rows }: { rows: DrawdownRow[] }) {
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-gray-500">
            <th>Age</th><th>Year</th><th>Expense (inflated)</th><th>Corpus balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.age} className="border-t">
              <td>{r.age}</td>
              <td>{r.year}</td>
              <td>{formatINR(r.annualExpenseInflated)}</td>
              <td>{formatINR(r.corpusBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
