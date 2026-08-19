import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "./retirement";
import type { CalculatorInput } from "./types";

// The canonical starting values, in one place. They used to live inside the
// tab components with a second, drifting copy inside the store's migration
// code — so a field added to one had to be remembered in the other.

export const DEFAULT_CALCULATOR_INPUT: CalculatorInput = {
  lumpsum: 0,
  monthlySip: 10_000,
  stepUpPct: 0,
  annualReturn: 12,
  years: 15,
  inflationPct: 6,
};

export const DEFAULT_RETIREMENT_INPUT: RetirementInput = {
  currentAge: 30,
  retirementAge: 55,
  lifespanAge: 85,
  currentMonthlyExpense: 50_000,
  inflationPct: 6,
  preReturnPct: 12,
  postReturnPct: 8,
  phases: [],
  assetClasses: DEFAULT_ASSET_CLASSES,
  currentMonthlyInvestment: 0,
  sipStepUpPct: 0,
  useBucketStrategy: false,
  bucketYears: 5,
  safeBucketRatePct: 7,
  growthBucketRatePct: 11,
};
