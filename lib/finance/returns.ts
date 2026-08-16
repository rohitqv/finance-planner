import { buildCashflows, accumulate } from "./accumulation";
import type { CalculatorInput } from "./types";

export function cagr(futureValue: number, totalInvested: number, years: number): number {
  if (totalInvested <= 0 || years <= 0) return 0;
  return Math.pow(futureValue / totalInvested, 1 / years) - 1;
}

// Newton-Raphson on a monthly rate, then annualize.
export function xirrFromCashflows(
  flows: { month: number; amount: number }[],
  finalInflow: number,
  finalMonth: number,
): number {
  const all = [...flows, { month: finalMonth, amount: finalInflow }];
  const npv = (monthlyRate: number) =>
    all.reduce((s, f) => s + f.amount / Math.pow(1 + monthlyRate, f.month), 0);
  const dNpv = (monthlyRate: number) =>
    all.reduce((s, f) => s - (f.month * f.amount) / Math.pow(1 + monthlyRate, f.month + 1), 0);

  let rate = 0.01; // 1% monthly guess
  for (let iter = 0; iter < 100; iter++) {
    const value = npv(rate);
    const deriv = dNpv(rate);
    if (Math.abs(deriv) < 1e-12) break;
    const next = rate - value / deriv;
    if (!isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-10) { rate = next; break; }
    rate = next <= -0.9999 ? -0.9999 : next;
  }
  return Math.pow(1 + rate, 12) - 1;
}

export function computeReturns(input: CalculatorInput): { cagr: number; xirr: number } {
  const { futureValue, totalInvested } = accumulate(input);
  const flows = buildCashflows(input);
  const finalMonth = Math.round(input.years * 12);
  return {
    cagr: cagr(futureValue, totalInvested, input.years),
    xirr: xirrFromCashflows(flows, futureValue, finalMonth),
  };
}
