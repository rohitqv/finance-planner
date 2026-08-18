"use client";
import { includedCorpusAmount, type AssetClass } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function AssetClassTable({
  value, onChange,
}: { value: AssetClass[]; onChange: (v: AssetClass[]) => void }) {
  const update = (key: AssetClass["key"], patch: Partial<AssetClass>) => {
    onChange(value.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">Asset class</th>
            <th className="py-1">Amount (₹)</th>
            <th className="py-1">Rate (%)</th>
            <th className="py-1">Include</th>
          </tr>
        </thead>
        <tbody>
          {value.map((a) => (
            <tr key={a.key} className="border-t">
              <td className="py-1">{a.label}</td>
              <td className="py-1">
                <input
                  aria-label={`${a.label} amount`}
                  type="number"
                  className="w-full rounded border px-2 py-1"
                  value={a.amount}
                  onChange={(e) => update(a.key, { amount: Number(e.target.value) })}
                />
              </td>
              <td className="py-1">
                <input
                  aria-label={`${a.label} rate`}
                  type="number"
                  className="w-full rounded border px-2 py-1"
                  value={a.ratePct}
                  onChange={(e) => update(a.key, { ratePct: Number(e.target.value) })}
                />
              </td>
              <td className="py-1 text-center">
                <input
                  aria-label={`Include ${a.label} in retirement`}
                  type="checkbox"
                  checked={a.includeInRetirement}
                  onChange={(e) => update(a.key, { includeInRetirement: e.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {value.some((a) => a.key === "epfo") ? (
        <p className="mt-1 text-xs text-gray-500">
          8.25% is the current government-declared EPF rate — edit if you
          expect it to change.
        </p>
      ) : null}
      <p className="mt-2 text-sm">
        Current corpus counted toward retirement:{" "}
        <span className="font-semibold">{formatINR(includedCorpusAmount(value))}</span>
      </p>
    </div>
  );
}
