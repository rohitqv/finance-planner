import type { CalculatorInput, MonthlyPoint } from "./types";

export function buildCashflows(input: CalculatorInput): { month: number; amount: number }[] {
  const flows: { month: number; amount: number }[] = [];
  const months = Math.round(input.years * 12);
  if (input.lumpsum > 0) flows.push({ month: 0, amount: -input.lumpsum });
  if (input.monthlySip > 0) {
    for (let m = 1; m <= months; m++) {
      const yearIndex = Math.floor((m - 1) / 12); // 0-based year
      const sip = input.monthlySip * Math.pow(1 + input.stepUpPct / 100, yearIndex);
      flows.push({ month: m, amount: -sip });
    }
  }
  return flows;
}

export function accumulate(input: CalculatorInput): {
  futureValue: number;
  totalInvested: number;
  series: MonthlyPoint[];
} {
  const months = Math.round(input.years * 12);
  const i = Math.pow(1 + input.annualReturn / 100, 1 / 12) - 1; // effective monthly rate
  const flows = buildCashflows(input);

  let totalInvested = 0;
  for (const f of flows) totalInvested += -f.amount;

  const futureValue = flows.reduce((acc, f) => {
    const grownMonths = months - f.month;
    return acc + -f.amount * Math.pow(1 + i, grownMonths);
  }, 0);

  // Yearly series: value and invested-to-date at each year end.
  const series: MonthlyPoint[] = [];
  for (let y = 1; y <= input.years; y++) {
    const atMonth = y * 12;
    let invested = 0;
    let value = 0;
    for (const f of flows) {
      if (f.month <= atMonth) {
        invested += -f.amount;
        value += -f.amount * Math.pow(1 + i, atMonth - f.month);
      }
    }
    series.push({ month: atMonth, invested, value });
  }

  return { futureValue, totalInvested, series };
}
