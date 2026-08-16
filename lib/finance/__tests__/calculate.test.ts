import { describe, it, expect } from "vitest";
import { calculate } from "@/lib/finance/calculate";
import type { CalculatorInput } from "@/lib/finance/types";

const input: CalculatorInput = {
  lumpsum: 1_000_000, monthlySip: 10_000, stepUpPct: 10,
  annualReturn: 12, years: 15, inflationPct: 6,
};

describe("calculate", () => {
  it("returns a full, self-consistent result", () => {
    const r = calculate(input);
    expect(r.gain).toBeCloseTo(r.futureValue - r.totalInvested, 2);
    expect(r.inflationAdjustedFV).toBeLessThan(r.futureValue);
    expect(r.futureValue).toBeGreaterThan(r.totalInvested);
  });
});
