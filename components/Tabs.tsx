"use client";
export default function Tabs({
  tabs, active, onSelect,
}: { tabs: string[]; active: number; onSelect: (i: number) => void }) {
  return (
    <div className="mb-6 flex gap-2 border-b">
      {tabs.map((t, i) => (
        <button
          key={t}
          className={`px-4 py-2 ${i === active ? "border-b-2 border-blue-600 font-semibold" : "text-gray-500"}`}
          onClick={() => onSelect(i)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
