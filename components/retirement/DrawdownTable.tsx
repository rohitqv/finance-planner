"use client";
import { isBucketDrawdown, type DrawdownRow, type BucketDrawdownRow } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";
import TableDisclosure from "@/components/ui/TableDisclosure";

const TH = "px-3 py-2 text-left font-semibold";
const TD = "px-3 py-2 tabular-nums";

function Shortfall({ amount }: { amount: number }) {
  if (amount <= 0) return <span className="text-gray-400 dark:text-gray-500">—</span>;
  return <span className="font-medium text-red-600 dark:text-red-400">{formatINR(amount)}</span>;
}

export default function DrawdownTable({ rows }: { rows: DrawdownRow[] | BucketDrawdownRow[] }) {
  // The column only appears when there is something to show: a drawdown of
  // the required corpus is solved to fund every year, so an always-present
  // column of dashes would just be noise there.
  const hasShortfall = rows.some((r) => r.shortfall > 0);
  const bucket = isBucketDrawdown(rows);

  return (
    <TableDisclosure label="Show year-by-year drawdown">
      {bucket ? (
        <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">
          Safe, Growth, and Total figures are end-of-year balances, after that year&apos;s growth has been applied.
        </p>
      ) : null}
      <div className="max-h-80 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <caption className="sr-only">
            Year-by-year retirement drawdown: expenses and remaining corpus by age.
          </caption>
          <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th scope="col" className={TH}>Age</th>
              <th scope="col" className={TH}>Year</th>
              <th scope="col" className={TH}>Expense (inflated)</th>
              {bucket ? (
                <>
                  <th scope="col" className={TH}>Safe bucket</th>
                  <th scope="col" className={TH}>Growth bucket</th>
                </>
              ) : null}
              <th scope="col" className={TH}>{bucket ? "Total" : "Corpus balance"}</th>
              {hasShortfall ? <th scope="col" className={TH}>Shortfall</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.age}
                className={`border-t dark:border-gray-700 ${
                  r.shortfall > 0 ? "bg-red-50/60 dark:bg-red-950/40" : ""
                }`}
              >
                <th scope="row" className={`${TD} text-left font-normal`}>{r.age}</th>
                <td className={TD}>{r.year}</td>
                <td className={TD}>{formatINR(r.annualExpenseInflated)}</td>
                {isBucketDrawdown(rows) ? (
                  <>
                    <td className={TD}>{formatINR((r as BucketDrawdownRow).safeBalance)}</td>
                    <td className={TD}>{formatINR((r as BucketDrawdownRow).growthBalance)}</td>
                  </>
                ) : null}
                <td className={TD}>{formatINR(r.corpusBalance)}</td>
                {hasShortfall ? (
                  <td className={TD}><Shortfall amount={r.shortfall} /></td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </TableDisclosure>
  );
}
