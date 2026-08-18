import { accumulate } from "./accumulation";
import type { MonthlyPoint } from "./types";

export type ExpensePhase = { fromAge: number; toAge: number; monthlyExpenseToday: number };

export type AssetClassKey = "mutualFund" | "gold" | "epfo" | "fixedDeposit" | "realEstate";
export type AssetClass = {
  key: AssetClassKey;
  label: string;
  amount: number;
  ratePct: number;
  includeInRetirement: boolean;
};

export const DEFAULT_ASSET_CLASSES: AssetClass[] = [
  { key: "mutualFund", label: "Mutual Fund", amount: 0, ratePct: 12, includeInRetirement: true },
  { key: "gold", label: "Gold", amount: 0, ratePct: 8, includeInRetirement: true },
  { key: "epfo", label: "EPFO", amount: 0, ratePct: 8.25, includeInRetirement: true },
  { key: "fixedDeposit", label: "Fixed Deposit", amount: 0, ratePct: 7, includeInRetirement: true },
  { key: "realEstate", label: "Real Estate", amount: 0, ratePct: 8, includeInRetirement: true },
];

export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  lifespanAge: number;
  currentMonthlyExpense: number;
  inflationPct: number;
  preReturnPct: number;
  postReturnPct: number;
  phases: ExpensePhase[];
  assetClasses: AssetClass[];
  currentMonthlyInvestment: number;
  useBucketStrategy: boolean;
  bucketYears: number;
  safeBucketRatePct: number;
  growthBucketRatePct: number;
};

// Future value at `years` from now of every asset class with
// includeInRetirement: true, each compounded at its own rate. Excluded
// classes contribute nothing — not zero-weighted, simply skipped.
export function includedCorpusFutureValue(assetClasses: AssetClass[], years: number): number {
  return assetClasses
    .filter((a) => a.includeInRetirement)
    .reduce((sum, a) => sum + accumulate({
      lumpsum: a.amount, monthlySip: 0, stepUpPct: 0,
      annualReturn: a.ratePct, years, inflationPct: 0,
    }).futureValue, 0);
}

// Today's value (no growth) summed over included asset classes only.
export function includedCorpusAmount(assetClasses: AssetClass[]): number {
  return assetClasses
    .filter((a) => a.includeInRetirement)
    .reduce((sum, a) => sum + a.amount, 0);
}

export type DrawdownRow = {
  age: number; year: number; yearsFromNow: number;
  annualExpenseToday: number; annualExpenseInflated: number; corpusBalance: number;
};
export type AccumulationSplitResult = {
  required: MonthlyPoint[];
  surplus: MonthlyPoint[] | null;
};
export type RetirementResult = {
  corpusNeededAtRetirement: number;
  corpusNeededToday: number;
  requiredMonthlySip: number;
  projectedCorpusFromCurrentPlan: number;
  gap: number;
  extraSipToCloseGap: number;
  drawdown: DrawdownRow[] | BucketDrawdownRow[];
};

export function annualExpenseTodayForAge(input: RetirementInput, age: number): number {
  const phase = input.phases.find((p) => age >= p.fromAge && age <= p.toAge);
  const monthly = phase ? phase.monthlyExpenseToday : input.currentMonthlyExpense;
  return monthly * 12;
}

export type BucketDrawdownRow = DrawdownRow & { safeBalance: number; growthBalance: number };

export function isBucketDrawdown(
  rows: DrawdownRow[] | BucketDrawdownRow[],
): rows is BucketDrawdownRow[] {
  return rows.length > 0 && "safeBalance" in rows[0];
}

type BucketState = { safeBalance: number; growthBalance: number };

function bucketYearlyExpense(input: RetirementInput, age: number, infl: number): number {
  return annualExpenseTodayForAge(input, age) * Math.pow(1 + infl, age - input.currentAge);
}

// Sum of the inflated expenses for the `bucketYears` years *after* `age`,
// capped at however many years remain until lifespanAge. This is the
// safe bucket's target size once this year's withdrawal is done.
function bucketRefillTarget(input: RetirementInput, age: number, infl: number): number {
  const remainingYears = Math.max(0, input.lifespanAge - age);
  const span = Math.min(input.bucketYears, remainingYears);
  let target = 0;
  for (let k = 1; k <= span; k++) target += bucketYearlyExpense(input, age + k, infl);
  return target;
}

// One year of bucket-strategy drawdown: withdraw this year's expense from
// the safe bucket, grow both buckets at their own rate, then rebalance the
// safe bucket back to `bucketRefillTarget`, moving the difference to/from
// the growth bucket. A transfer *into* the safe bucket is capped at the
// growth bucket's balance (money can't come from nowhere) and both balances
// floor at 0.
function stepBucketYear(
  input: RetirementInput, state: BucketState, age: number, infl: number,
): BucketState {
  const expense = bucketYearlyExpense(input, age, infl);
  let safeBalance = (state.safeBalance - expense) * (1 + input.safeBucketRatePct / 100);
  let growthBalance = state.growthBalance * (1 + input.growthBucketRatePct / 100);

  const target = bucketRefillTarget(input, age, infl);
  const desiredTransfer = target - safeBalance;
  const transfer = desiredTransfer > 0
    ? Math.min(desiredTransfer, growthBalance)
    : desiredTransfer;
  safeBalance += transfer;
  growthBalance -= transfer;

  safeBalance = Math.max(0, safeBalance);
  growthBalance = Math.max(0, growthBalance);
  return { safeBalance, growthBalance };
}

// Split the starting corpus at retirement: `bucketYears` worth of expense
// (starting with this year's) goes to the safe bucket, the rest to growth.
function initialBucketSplit(
  input: RetirementInput, startingCorpus: number, infl: number,
): BucketState {
  const span = Math.min(input.bucketYears, input.lifespanAge - input.retirementAge + 1);
  let initialTarget = 0;
  for (let k = 0; k < span; k++) {
    initialTarget += bucketYearlyExpense(input, input.retirementAge + k, infl);
  }
  const safeBalance = Math.min(startingCorpus, initialTarget);
  const growthBalanceRaw = startingCorpus - initialTarget;
  return { safeBalance, growthBalance: Math.max(0, growthBalanceRaw) };
}

type BucketYearRow = {
  age: number; yearsFromNow: number; annualExpenseToday: number; annualExpenseInflated: number;
  safeBalance: number; growthBalance: number;
};

function runBucketYears(input: RetirementInput, startingCorpus: number): BucketYearRow[] {
  const infl = input.inflationPct / 100;
  let state = initialBucketSplit(input, startingCorpus, infl);
  const rows: BucketYearRow[] = [];
  for (let age = input.retirementAge; age <= input.lifespanAge; age++) {
    state = stepBucketYear(input, state, age, infl);
    rows.push({
      age, yearsFromNow: age - input.currentAge,
      annualExpenseToday: annualExpenseTodayForAge(input, age),
      annualExpenseInflated: bucketYearlyExpense(input, age, infl),
      safeBalance: state.safeBalance, growthBalance: state.growthBalance,
    });
  }
  return rows;
}

export function simulateBucketDrawdown(input: RetirementInput, startingCorpus: number): BucketDrawdownRow[] {
  const nowYear = new Date().getFullYear();
  return runBucketYears(input, startingCorpus).map((r) => ({
    age: r.age, year: nowYear + r.yearsFromNow, yearsFromNow: r.yearsFromNow,
    annualExpenseToday: r.annualExpenseToday, annualExpenseInflated: r.annualExpenseInflated,
    corpusBalance: r.safeBalance + r.growthBalance,
    safeBalance: r.safeBalance, growthBalance: r.growthBalance,
  }));
}

// Bracket-and-bisect on the starting corpus (same technique as the XIRR
// solver in lib/finance/returns.ts, but the search variable here is a
// rupee amount, not a rate): find the starting corpus whose ending balance
// at lifespanAge is exactly 0. Display-mode ending balance floors at 0 once
// a corpus is insufficient, so <= 0 (not < 0) is the 'still insufficient'
// test; because every step is built from min/max (continuous, monotonic
// non-decreasing functions), the balance is continuous and monotonic
// non-decreasing in the starting corpus, so this still correctly brackets
// the point where it first becomes positive.
export function solveBucketCorpusNeeded(input: RetirementInput): number {
  if (input.lifespanAge < input.retirementAge) return 0;

  const endingBalance = (corpus: number): number => {
    const rows = runBucketYears(input, corpus);
    const last = rows[rows.length - 1];
    return last.safeBalance + last.growthBalance;
  };

  let lo = 0;
  let hi = Math.max(1, bucketYearlyExpense(input, input.retirementAge, input.inflationPct / 100));
  let bracketed = false;
  for (let iter = 0; iter < 100; iter++) {
    if (endingBalance(hi) > 0) { bracketed = true; break; }
    hi *= 2;
  }
  // No finite corpus reached a positive ending balance within a safe,
  // bounded search range (e.g. a bucket rate at or below -100%, which
  // collapses growth to 0 or negative every year) — an explicit failure
  // signal, matching xirrFromCashflows's NaN sentinel in returns.ts, not
  // a plausible-looking but meaningless number.
  if (!bracketed) return NaN;

  for (let iter = 0; iter < 100; iter++) {
    if (hi - lo < 1e-6) break;
    const mid = (lo + hi) / 2;
    if (endingBalance(mid) <= 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Solve flat month-end SIP so that grownCorpus + SIP stream reaches target.
// `grownCorpus` is the corpus already projected forward to `years` from now
// (see includedCorpusFutureValue) — this function no longer grows a corpus
// itself, since callers may be summing several asset classes each compounding
// at a different rate.
export function requiredSip(
  target: number, years: number, annualReturnPct: number, grownCorpus: number,
): number {
  const remaining = target - grownCorpus;
  if (remaining <= 0) return 0;
  // With zero (or negative) years there is no time for any monthly SIP to
  // accumulate anything (fvPerUnit below would be 0), so a positive
  // remaining gap can never be closed by a SIP, however large. Return
  // Infinity explicitly here rather than falling through to `remaining / 0`,
  // so this is an intentional "unreachable via SIP" signal, not an
  // accidental division-by-zero artifact.
  if (years <= 0) return Infinity;
  // FV of 1 unit monthly SIP over the horizon (linear in SIP), then scale.
  const fvPerUnit = accumulate({
    lumpsum: 0, monthlySip: 1, stepUpPct: 0,
    annualReturn: annualReturnPct, years, inflationPct: 0,
  }).futureValue;
  return remaining / fvPerUnit;
}

export function computeRetirement(input: RetirementInput): RetirementResult {
  const accumYears = input.retirementAge - input.currentAge;
  const nowYear = new Date().getFullYear();
  const infl = input.inflationPct / 100;
  const post = input.postReturnPct / 100;

  // Build the drawdown schedule (retirement age .. lifespan age inclusive).
  const drawdown: DrawdownRow[] = [];
  let corpusNeededAtRetirement = 0;
  const rows: { age: number; yearsFromNow: number; annualExpenseToday: number; annualExpenseInflated: number }[] = [];
  for (let age = input.retirementAge; age <= input.lifespanAge; age++) {
    const yearsFromNow = age - input.currentAge;
    const annualExpenseToday = annualExpenseTodayForAge(input, age);
    const annualExpenseInflated = annualExpenseToday * Math.pow(1 + infl, yearsFromNow);
    rows.push({ age, yearsFromNow, annualExpenseToday, annualExpenseInflated });
    // Present value at retirement of this year's expense (expense drawn at year start).
    const yearsIntoRetirement = age - input.retirementAge;
    corpusNeededAtRetirement += annualExpenseInflated / Math.pow(1 + post, yearsIntoRetirement);
  }

  // Fill running balance for display.
  let bal = corpusNeededAtRetirement;
  for (const r of rows) {
    const startBal = bal;
    bal = startBal - r.annualExpenseInflated; // withdraw at start of year
    bal = bal * (1 + post);                   // grow for the year
    drawdown.push({
      age: r.age, year: nowYear + r.yearsFromNow, yearsFromNow: r.yearsFromNow,
      annualExpenseToday: r.annualExpenseToday, annualExpenseInflated: r.annualExpenseInflated,
      corpusBalance: Math.max(0, startBal - r.annualExpenseInflated),
    });
  }

  let finalCorpusNeededAtRetirement = corpusNeededAtRetirement;
  let finalDrawdown: DrawdownRow[] | BucketDrawdownRow[] = drawdown;
  if (input.useBucketStrategy) {
    finalCorpusNeededAtRetirement = solveBucketCorpusNeeded(input);
    finalDrawdown = simulateBucketDrawdown(input, finalCorpusNeededAtRetirement);
  }

  const corpusNeededToday = finalCorpusNeededAtRetirement / Math.pow(1 + infl, accumYears);
  const grownCorpus = includedCorpusFutureValue(input.assetClasses, accumYears);
  const requiredMonthlySip = requiredSip(
    finalCorpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus,
  );

  const investmentStreamFv = accumulate({
    lumpsum: 0, monthlySip: input.currentMonthlyInvestment, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).futureValue;
  const projectedCorpusFromCurrentPlan = grownCorpus + investmentStreamFv;

  const gap = finalCorpusNeededAtRetirement - projectedCorpusFromCurrentPlan;
  const extraSipToCloseGap = gap > 0
    ? requiredSip(finalCorpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus)
        - input.currentMonthlyInvestment
    : 0;

  return {
    corpusNeededAtRetirement: finalCorpusNeededAtRetirement,
    corpusNeededToday,
    requiredMonthlySip,
    projectedCorpusFromCurrentPlan,
    gap,
    extraSipToCloseGap: Math.max(0, extraSipToCloseGap),
    drawdown: finalDrawdown,
  };
}

export function computeAccumulationSplit(
  input: RetirementInput, requiredMonthlySip: number,
): AccumulationSplitResult {
  const accumYears = input.retirementAge - input.currentAge;
  if (accumYears <= 0 || !Number.isFinite(requiredMonthlySip)) {
    return { required: [], surplus: null };
  }

  const sipSeries = accumulate({
    lumpsum: 0, monthlySip: requiredMonthlySip, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).series;

  const assetSeriesList = input.assetClasses
    .filter((a) => a.includeInRetirement)
    .map((a) => accumulate({
      lumpsum: a.amount, monthlySip: 0, stepUpPct: 0,
      annualReturn: a.ratePct, years: accumYears, inflationPct: 0,
    }).series);

  // Every series above was built with the same `years`, so they're the same
  // length with matching `month` at each index — safe to zip-sum by index.
  const required: MonthlyPoint[] = sipSeries.map((point, idx) => ({
    month: point.month,
    invested: assetSeriesList.reduce((sum, s) => sum + s[idx].invested, point.invested),
    value: assetSeriesList.reduce((sum, s) => sum + s[idx].value, point.value),
  }));

  const surplusAmount = input.currentMonthlyInvestment - requiredMonthlySip;
  const surplus = surplusAmount > 0
    ? accumulate({
        lumpsum: 0, monthlySip: surplusAmount, stepUpPct: 0,
        annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
      }).series
    : null;

  return { required, surplus };
}
