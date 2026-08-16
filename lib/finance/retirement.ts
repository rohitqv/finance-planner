import { accumulate } from "./accumulation";

export type ExpensePhase = { fromAge: number; toAge: number; monthlyExpenseToday: number };
export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  lifespanAge: number;
  currentMonthlyExpense: number;
  inflationPct: number;
  preReturnPct: number;
  postReturnPct: number;
  phases: ExpensePhase[];
  currentCorpus: number;
  currentMonthlyInvestment: number;
};
export type DrawdownRow = {
  age: number; year: number; yearsFromNow: number;
  annualExpenseToday: number; annualExpenseInflated: number; corpusBalance: number;
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

// Solve flat month-end SIP so that currentCorpus + SIP stream reaches target.
export function requiredSip(
  target: number, years: number, annualReturnPct: number, currentCorpus: number,
): number {
  const grownCorpus = accumulate({
    lumpsum: currentCorpus, monthlySip: 0, stepUpPct: 0,
    annualReturn: annualReturnPct, years, inflationPct: 0,
  }).futureValue;
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
  const requiredMonthlySip = requiredSip(
    corpusNeededAtRetirement, accumYears, input.preReturnPct, input.currentCorpus,
  );

  const projectedCorpusFromCurrentPlan = accumulate({
    lumpsum: input.currentCorpus, monthlySip: input.currentMonthlyInvestment, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).futureValue;

  const gap = corpusNeededAtRetirement - projectedCorpusFromCurrentPlan;
  const extraSipToCloseGap = gap > 0
    ? requiredSip(corpusNeededAtRetirement, accumYears, input.preReturnPct,
        input.currentCorpus) - input.currentMonthlyInvestment
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
