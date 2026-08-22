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
  // How many times over the invested money grew, e.g. 2.62 for 2.62x. A
  // plain ratio, deliberately *not* annualized: annualizing FV/invested
  // treats a stream of monthly contributions as if every rupee were
  // deployed on day one, which understates the rate badly (6.63% vs a true
  // 12% on this app's default input). XIRR below is the annualized figure.
  growthMultiple: number;
  xirr: number;            // fraction, annualized, timing-aware
  inflationAdjustedFV: number;
};

export type MonthlyPoint = { month: number; invested: number; value: number };
