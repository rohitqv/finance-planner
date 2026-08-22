import { buildCashflows, accumulate } from "./accumulation";
import type { CalculatorInput } from "./types";

// There was a `cagr(futureValue, totalInvested, years)` here, computing
// (FV / invested)^(1/years) - 1, and it was displayed beside XIRR as a peer
// "return" figure. It is not one, and it is gone deliberately rather than
// hidden behind a condition:
//
//   - For a contribution *stream* the formula is wrong. It divides by the
//     undiscounted sum of every instalment, as though money paid in year 14
//     had been compounding since year 0. On this app's default input it
//     reports 6.63% against a true 12% — two "returns" 5.4pp apart on screen.
//   - For a lumpsum-only input it is correct, and exactly equal to XIRR
//     (verified across rates and horizons), so it adds nothing there either.
//
// Redundant when right and misleading when wrong, in every case XIRR already
// covers. What it was gesturing at — how far the money grew — is reported
// honestly and un-annualized as `growthMultiple` in lib/finance/calculate.ts.

// A cashflow sequence with exactly one sign change (some negative
// outflows followed by one non-negative inflow, or vice versa) has an
// NPV(rate) that is strictly monotonically decreasing and has at most one
// root for rate > -1 (standard IRR uniqueness result), which is what
// makes bracket-and-bisect below provably robust — unlike unbounded
// Newton-Raphson, which previously diverged to an astronomical value for
// SIP-only series with a negative true rate (the NPV curve is very flat
// on the positive side, so Newton's fixed +1%-guess took ever-larger
// steps chasing an asymptote instead of stepping toward the negative
// root). This app's own cashflows (see buildCashflows) satisfy that
// precondition for `lumpsum >= 0`, `monthlySip >= 0`, and
// `stepUpPct >= -100` (a step-up below -100% flips the per-year SIP sign
// and breaks the single-sign-change assumption — unvalidated at the UI
// layer, a pre-existing gap this fix doesn't address).
function bracketRoot(npv: (rate: number) => number): { lo: number; hi: number } | null {
  const atZero = npv(0);
  if (atZero === 0) return { lo: 0, hi: 0 };
  const positiveSide = atZero > 0; // npv is decreasing, so npv(0) > 0 means the root is at rate > 0.
  let known = 0;
  let step = 0.5;
  for (let iter = 0; iter < 100; iter++) {
    // Expand outward from `known`, doubling on success. Halve on overflow
    // instead: (1+rate)^month underflows toward 0 as rate approaches -1
    // for long horizons/large amounts, which can blow npv up to
    // +/-Infinity or NaN.
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
  // NaN, not 0 — a returned 0 would be indistinguishable from a genuine
  // break-even result. This path is only reached when no root could be
  // bracketed within a safe finite range (e.g. the single-sign-change
  // precondition above doesn't hold, or magnitudes overflow even at the
  // search's smallest step) — a real failure, not a computed answer.
  if (!bracket) return NaN;
  const rate = bisect(npv, bracket.lo, bracket.hi);
  return Math.pow(1 + rate, 12) - 1;
}

export function computeReturns(input: CalculatorInput): { xirr: number } {
  const { futureValue } = accumulate(input);
  const flows = buildCashflows(input);
  const finalMonth = Math.round(input.years * 12);
  return {
    xirr: flows.length === 0 ? 0 : xirrFromCashflows(flows, futureValue, finalMonth),
  };
}
