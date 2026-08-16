import { describe, it, expect } from "vitest";
import { cagr, computeReturns } from "@/lib/finance/returns";
import type { CalculatorInput } from "@/lib/finance/types";

const base: CalculatorInput = {
  lumpsum: 0, monthlySip: 0, stepUpPct: 0,
  annualReturn: 12, years: 10, inflationPct: 0,
};

describe("cagr", () => {
  it("computes annualized growth", () => {
    expect(cagr(2_000_000, 1_000_000, 10)).toBeCloseTo(Math.pow(2, 0.1) - 1, 6);
  });
  it("returns 0 when nothing was invested", () => {
    expect(cagr(0, 0, 10)).toBe(0);
  });
});

describe("computeReturns — pure lumpsum", () => {
  it("CAGR and XIRR both equal the input rate", () => {
    const r = computeReturns({ ...base, lumpsum: 1_000_000, monthlySip: 0 });
    expect(r.cagr).toBeCloseTo(0.12, 4);
    expect(r.xirr).toBeCloseTo(0.12, 4);
  });
});

describe("computeReturns — pure SIP", () => {
  it("XIRR is near the input rate; CAGR is below it", () => {
    const r = computeReturns({ ...base, monthlySip: 10_000, annualReturn: 12 });
    expect(r.xirr).toBeCloseTo(0.12, 2);
    expect(r.cagr).toBeLessThan(r.xirr);
  });
});

describe("computeReturns — zero investment", () => {
  it("XIRR is 0, matching CAGR, when there is no lumpsum and no SIP", () => {
    const r = computeReturns({ ...base, lumpsum: 0, monthlySip: 0 });
    expect(r.cagr).toBe(0);
    expect(r.xirr).toBe(0);
  });
});
