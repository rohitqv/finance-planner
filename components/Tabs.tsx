"use client";
export default function Tabs({
  tabs, active, onSelect,
}: { tabs: string[]; active: number; onSelect: (i: number) => void }) {
  return (
    <div className="mb-6 inline-flex gap-1 rounded-full bg-gray-100 p-1">
      {tabs.map((t, i) => (
        <button
          key={t}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            i === active
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
          }`}
          onClick={() => onSelect(i)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
