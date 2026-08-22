import { accumulate } from "./accumulation";
import { computeReturns } from "./returns";
import { realValue } from "./inflation";
import type { CalculatorInput, CalculatorResult, MonthlyPoint } from "./types";

export function calculate(input: CalculatorInput): CalculatorResult {
  const { futureValue, totalInvested } = accumulate(input);
  const { xirr } = computeReturns(input);
  return {
    futureValue,
    totalInvested,
    gain: futureValue - totalInvested,
    // 0, not Infinity/NaN, when nothing was invested: the UI gates on
    // validation, but ScenarioTable calls calculate() directly on stored
    // rows, which can legitimately be all-zero.
    growthMultiple: totalInvested > 0 ? futureValue / totalInvested : 0,
    xirr,
    inflationAdjustedFV: realValue(futureValue, input.inflationPct, input.years),
  };
}

export function calculateSeries(input: CalculatorInput): MonthlyPoint[] {
  return accumulate(input).series;
}
