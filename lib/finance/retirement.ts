import { accumulate } from "./accumulation";
import type { MonthlyPoint } from "./types";

export type ExpensePhase = { fromAge: number; toAge: number; monthlyExpenseToday: number };

export type AssetClassKey = "mutualFund" | "gold" | "epfo" | "realEstate";
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
  drawdown: DrawdownRow[];
};

export function annualExpenseTodayForAge(input: RetirementInput, age: number): number {
  const phase = input.phases.find((p) => age >= p.fromAge && age <= p.toAge);
  const monthly = phase ? phase.monthlyExpenseToday : input.currentMonthlyExpense;
  return monthly * 12;
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

  const corpusNeededToday = corpusNeededAtRetirement / Math.pow(1 + infl, accumYears);
  const grownCorpus = includedCorpusFutureValue(input.assetClasses, accumYears);
  const requiredMonthlySip = requiredSip(
    corpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus,
  );

  const investmentStreamFv = accumulate({
    lumpsum: 0, monthlySip: input.currentMonthlyInvestment, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).futureValue;
  const projectedCorpusFromCurrentPlan = grownCorpus + investmentStreamFv;

  const gap = corpusNeededAtRetirement - projectedCorpusFromCurrentPlan;
  const extraSipToCloseGap = gap > 0
    ? requiredSip(corpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus)
        - input.currentMonthlyInvestment
    : 0;

  return {
    corpusNeededAtRetirement,
    corpusNeededToday,
    requiredMonthlySip,
    projectedCorpusFromCurrentPlan,
    gap,
    extraSipToCloseGap: Math.max(0, extraSipToCloseGap),
    drawdown,
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
