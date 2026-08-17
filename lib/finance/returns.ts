import { buildCashflows, accumulate } from "./accumulation";
import type { CalculatorInput } from "./types";

export function cagr(futureValue: number, totalInvested: number, years: number): number {
  if (totalInvested <= 0 || years <= 0) return 0;
  return Math.pow(futureValue / totalInvested, 1 / years) - 1;
}

// Every cashflow series this app builds (see buildCashflows) is some
// negative outflows (lumpsum/SIP contributions, always >= 0 so always
// non-positive amounts) followed by exactly one non-negative terminal
// inflow (the projected future value). A cashflow sequence with exactly
// one sign change has an NPV(rate) that is strictly monotonically
// decreasing and has at most one root for rate > -1 (standard IRR
// uniqueness result) — so a bracket-and-bisect search is guaranteed to
// find it, unlike unbounded Newton-Raphson, which previously diverged to
// an astronomical value for SIP-only series with a negative true rate:
// the NPV curve is very flat on the positive side, and Newton's fixed
// +1%-guess would take ever-larger steps chasing an asymptote instead of
// stepping toward the (correct) negative root.
//
// Finds [lo, hi] with opposite-sign npv() by expanding away from rate=0,
// doubling the step on each successful move and halving it whenever a
// step would overflow (dividing by (1+rate)^month underflows toward 0
// for very long horizons/large amounts as rate approaches -1, which can
// blow up to +/-Infinity or NaN).
function bracketRoot(npv: (rate: number) => number): { lo: number; hi: number } | null {
  const atZero = npv(0);
  if (atZero === 0) return { lo: 0, hi: 0 };
  const positiveSide = atZero > 0; // npv is decreasing, so npv(0) > 0 means the root is at rate > 0.
  let known = 0;
  let step = 0.5;
  for (let iter = 0; iter < 100; iter++) {
    let candidate = positiveSide ? known + step : known - step;
    if (!positiveSide && candidate <= -1) candidate = known + (-1 - known) / 2;
    const value = npv(candidate);
    if (!isFinite(value)) { step /= 2; continue; }
    if ((value > 0) !== positiveSide) {
      return positiveSide ? { lo: known, hi: candidate } : { lo: candidate, hi: known };
    }
    known = candidate;
    step *= 2;
  }
  return null; // no root found within a safe, finite range
}

function bisect(npv: (rate: number) => number, lo: number, hi: number): number {
  let npvLo = npv(lo);
  for (let iter = 0; iter < 100; iter++) {
    const mid = (lo + hi) / 2;
    const npvMid = npv(mid);
    if (npvMid === 0 || hi - lo < 1e-12) return mid;
    if ((npvLo > 0) === (npvMid > 0)) { lo = mid; npvLo = npvMid; } else { hi = mid; }
  }
  return (lo + hi) / 2;
}

// Bracket-and-bisect on a monthly rate, then annualize.
export function xirrFromCashflows(
  flows: { month: number; amount: number }[],
  finalInflow: number,
  finalMonth: number,
): number {
  const all = [...flows, { month: finalMonth, amount: finalInflow }];
  const npv = (monthlyRate: number) =>
    all.reduce((s, f) => s + f.amount / Math.pow(1 + monthlyRate, f.month), 0);

  const bracket = bracketRoot(npv);
  if (!bracket) return 0; // no root found (e.g. a degenerate/single-sign cashflow series)
  const rate = bisect(npv, bracket.lo, bracket.hi);
  return Math.pow(1 + rate, 12) - 1;
}

export function computeReturns(input: CalculatorInput): { cagr: number; xirr: number } {
  const { futureValue, totalInvested } = accumulate(input);
  const flows = buildCashflows(input);
  const finalMonth = Math.round(input.years * 12);
  return {
    cagr: cagr(futureValue, totalInvested, input.years),
    xirr: flows.length === 0 ? 0 : xirrFromCashflows(flows, futureValue, finalMonth),
  };
}
