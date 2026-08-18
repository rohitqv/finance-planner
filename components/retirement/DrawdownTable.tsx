"use client";
import { isBucketDrawdown, type DrawdownRow, type BucketDrawdownRow } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function DrawdownTable({ rows }: { rows: DrawdownRow[] | BucketDrawdownRow[] }) {
  if (isBucketDrawdown(rows)) {
    return (
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-gray-500">
              <th>Age</th><th>Year</th><th>Expense (inflated)</th>
              <th>Safe bucket</th><th>Growth bucket</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.age} className="border-t">
                <td>{r.age}</td>
                <td>{r.year}</td>
                <td>{formatINR(r.annualExpenseInflated)}</td>
                <td>{formatINR(r.safeBalance)}</td>
                <td>{formatINR(r.growthBalance)}</td>
                <td>{formatINR(r.corpusBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
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
