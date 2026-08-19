"use client";

// Shown in place of results whenever the inputs can't produce a meaningful
// answer. Standing in for the numbers (rather than sitting beside them) is
// the point: a plan with a half-typed age still renders *some* figure, and a
// confident-looking wrong number is worse than an obvious gap.
export default function ValidationSummary({
  messages,
  title = "Check these inputs",
}: { messages: string[]; title?: string }) {
  if (messages.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm shadow-sm dark:border-red-800 dark:bg-red-950"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">
        {title}
      </h3>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-red-700 dark:text-red-300">
        {messages.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}
