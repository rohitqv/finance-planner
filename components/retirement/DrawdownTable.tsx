"use client";
import { isBucketDrawdown, type DrawdownRow, type BucketDrawdownRow } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";
import TableDisclosure from "@/components/ui/TableDisclosure";

export default function DrawdownTable({ rows }: { rows: DrawdownRow[] | BucketDrawdownRow[] }) {
  if (isBucketDrawdown(rows)) {
    return (
      <TableDisclosure label="Show year-by-year numbers">
        <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
          Safe, Growth, and Total figures are end-of-year balances, after that year&apos;s growth has been applied.
        </p>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white dark:bg-gray-900">
              <tr className="text-left text-gray-500 dark:text-gray-400">
                <th>Age</th><th>Year</th><th>Expense (inflated)</th>
                <th>Safe bucket</th><th>Growth bucket</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.age} className="border-t dark:border-gray-700">
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
      </TableDisclosure>
    );
  }
  return (
    <TableDisclosure label="Show year-by-year numbers">
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white dark:bg-gray-900">
            <tr className="text-left text-gray-500 dark:text-gray-400">
              <th>Age</th><th>Year</th><th>Expense (inflated)</th><th>Corpus balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.age} className="border-t dark:border-gray-700">
                <td>{r.age}</td>
                <td>{r.year}</td>
                <td>{formatINR(r.annualExpenseInflated)}</td>
                <td>{formatINR(r.corpusBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableDisclosure>
  );
}
