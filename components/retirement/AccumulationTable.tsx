"use client";
import type { MonthlyPoint } from "@/lib/finance/types";
import { formatINR } from "@/lib/finance/format";

export default function AccumulationTable({
  required, surplus, startAge,
}: { required: MonthlyPoint[]; surplus: MonthlyPoint[] | null; startAge: number }) {
  if (required.length === 0) return null;
  const nowYear = new Date().getFullYear();

  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-gray-500">
            <th>Age</th><th>Year</th><th>Required</th>
            {surplus ? <th>Surplus</th> : null}
            {surplus ? <th>Total</th> : null}
          </tr>
        </thead>
        <tbody>
          {required.map((r, i) => {
            const age = startAge + i + 1;
            const surplusValue = surplus ? surplus[i].value : 0;
            return (
              <tr key={age} className="border-t">
                <td>{age}</td>
                <td>{nowYear + i + 1}</td>
                <td>{formatINR(r.value)}</td>
                {surplus ? <td>{formatINR(surplusValue)}</td> : null}
                {surplus ? <td>{formatINR(r.value + surplusValue)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
