import { accumulate } from "./accumulation";
import { computeReturns } from "./returns";
import { realValue } from "./inflation";
import type { CalculatorInput, CalculatorResult, MonthlyPoint } from "./types";

export function calculate(input: CalculatorInput): CalculatorResult {
  const { futureValue, totalInvested } = accumulate(input);
  const { cagr, xirr } = computeReturns(input);
  return {
    futureValue,
    totalInvested,
    gain: futureValue - totalInvested,
    cagr,
    xirr,
    inflationAdjustedFV: realValue(futureValue, input.inflationPct, input.years),
  };
}

export function calculateSeries(input: CalculatorInput): MonthlyPoint[] {
  return accumulate(input).series;
}
