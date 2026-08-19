"use client";

export type DrawdownView = "required" | "projected";

const OPTIONS: { value: DrawdownView; label: string; hint: string }[] = [
  {
    value: "required",
    label: "Required corpus",
    hint: "The corpus this plan needs — funds every year exactly, ending at zero.",
  },
  {
    value: "projected",
    label: "Your projection",
    hint: "The corpus your current assets and monthly investment are on track for.",
  },
];

export default function DrawdownViewToggle({
  view, onChange, depletionAge, lifespanAge,
}: {
  view: DrawdownView;
  onChange: (v: DrawdownView) => void;
  depletionAge: number | null;
  lifespanAge: number;
}) {
  return (
    <div className="space-y-2">
      <div
        role="group"
        aria-label="Which corpus to draw down"
        className="inline-flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800"
      >
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={view === o.value}
            title={o.hint}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              view === o.value
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            }`}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      {depletionAge !== null ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          At your current monthly investment, the corpus runs out at age{" "}
          <strong>{depletionAge}</strong> — {lifespanAge - depletionAge + 1} year
          {lifespanAge - depletionAge + 1 === 1 ? "" : "s"} short of age {lifespanAge}.
        </p>
      ) : (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
          Your projected corpus funds every year through age <strong>{lifespanAge}</strong>.
        </p>
      )}
    </div>
  );
}
