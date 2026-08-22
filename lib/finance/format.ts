export function formatINR(n: number): string {
  const rounded = Math.round(n);
  return "₹" + rounded.toLocaleString("en-IN");
}

export function formatPct(fraction: number, dp = 2): string {
  return (fraction * 100).toFixed(dp) + "%";
}

// A growth ratio, e.g. 2.62 -> "2.62x". Not a percentage and not annualized
// — see the note on `growthMultiple` in lib/finance/types.ts.
export function formatMultiple(ratio: number, dp = 2): string {
  return ratio.toFixed(dp) + "x";
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}

// Compact Indian notation for chart axes and tight spaces: full grouping
// below a lakh ("₹1,23,456"), "₹85.2L" up to a crore, and "₹1.05Cr" above.
// Trailing zeros are trimmed so round numbers read as "₹8Cr", not "₹8.00Cr".
function trimCompact(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, "");
}

export function formatCompactINR(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${n < 0 ? "-" : ""}₹${trimCompact(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${n < 0 ? "-" : ""}₹${trimCompact(abs / 1e5)}L`;
  return formatINR(n);
}
