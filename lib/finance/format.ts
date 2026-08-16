export function formatINR(n: number): string {
  const rounded = Math.round(n);
  return "₹" + rounded.toLocaleString("en-IN");
}

export function formatPct(fraction: number, dp = 2): string {
  return (fraction * 100).toFixed(dp) + "%";
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}
