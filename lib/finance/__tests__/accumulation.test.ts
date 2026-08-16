import { describe, it, expect } from "vitest";
import { accumulate } from "@/lib/finance/accumulation";
import type { CalculatorInput } from "@/lib/finance/types";

const base: CalculatorInput = {
  lumpsum: 0, monthlySip: 0, stepUpPct: 0,
  annualReturn: 12, years: 10, inflationPct: 0,
};

describe("accumulate — pure lumpsum", () => {
  it("compounds a lumpsum at the monthly rate", () => {
    const r = accumulate({ ...base, lumpsum: 1_000_000, monthlySip: 0, annualReturn: 12, years: 10 });
    // 1,000,000 * (1 + 0.12/12)^120
    const expected = 1_000_000 * Math.pow(1 + 0.12 / 12, 120);
    expect(r.futureValue).toBeCloseTo(expected, 2);
    expect(r.totalInvested).toBe(1_000_000);
  });
});

describe("accumulate — pure SIP", () => {
  it("matches the ordinary-annuity FV formula", () => {
    const P = 10_000, i = 0.12 / 12, n = 120;
    const r = accumulate({ ...base, lumpsum: 0, monthlySip: P, annualReturn: 12, years: 10 });
    const expected = P * ((Math.pow(1 + i, n) - 1) / i);
    expect(r.futureValue).toBeCloseTo(expected, 2);
    expect(r.totalInvested).toBe(P * n);
  });
});

describe("accumulate — step-up SIP", () => {
  it("increases total invested vs. flat SIP and raises FV", () => {
    const flat = accumulate({ ...base, monthlySip: 10_000, stepUpPct: 0 });
    const stepped = accumulate({ ...base, monthlySip: 10_000, stepUpPct: 10 });
    expect(stepped.totalInvested).toBeGreaterThan(flat.totalInvested);
    expect(stepped.futureValue).toBeGreaterThan(flat.futureValue);
  });
  it("computes total invested as the summed yearly geometric series", () => {
    // year k (0-indexed) monthly SIP = 10000 * 1.1^k, 12 months each, 10 years
    let expected = 0;
    for (let k = 0; k < 10; k++) expected += 10_000 * Math.pow(1.1, k) * 12;
    const r = accumulate({ ...base, monthlySip: 10_000, stepUpPct: 10 });
    expect(r.totalInvested).toBeCloseTo(expected, 2);
  });
});

describe("accumulate — series", () => {
  it("emits one point per year with non-decreasing value", () => {
    const r = accumulate({ ...base, lumpsum: 100_000, monthlySip: 5_000 });
    expect(r.series).toHaveLength(10);
    expect(r.series[9].value).toBeCloseTo(r.futureValue, 2);
  });
});
