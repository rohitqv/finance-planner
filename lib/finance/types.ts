export type CalculatorInput = {
  lumpsum: number;      // X, >= 0
  monthlySip: number;   // Y, >= 0
  stepUpPct: number;    // s, annual %, >= 0
  annualReturn: number; // r, %
  years: number;        // Z, > 0 (whole years)
  inflationPct: number; // i, %, >= 0
};

export type CalculatorResult = {
  futureValue: number;
  totalInvested: number;
  gain: number;
  cagr: number;            // fraction, e.g. 0.12
  xirr: number;            // fraction
  inflationAdjustedFV: number;
};

export type MonthlyPoint = { month: number; invested: number; value: number };
