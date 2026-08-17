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

describe("computeReturns — pure SIP with a negative return", () => {
  // Regression test: for a level monthly SIP with no lumpsum, XIRR should
  // converge to essentially the exact input annual return (it's the IRR of
  // a constant-rate compounding annuity, which equals the compounding rate
  // itself), the same way the existing positive-return SIP case tracks its
  // input. Plain Newton-Raphson previously diverged to an astronomical,
  // nonsensical value here (e.g. "2.65e+99%") instead of finding the true
  // small negative root, because the initial +1% guess sits on the wrong
  // side of a negative root for this cashflow shape and there was no
  // bound/divergence safeguard.
  it("XIRR tracks a -3% input almost exactly", () => {
    const r = computeReturns({ ...base, monthlySip: 10_000, annualReturn: -3, years: 15 });
    expect(r.xirr).toBeCloseTo(-0.03, 6);
  });

  it("XIRR tracks a -20% input almost exactly (previously diverged)", () => {
    const r = computeReturns({ ...base, monthlySip: 10_000, annualReturn: -20, years: 15 });
    expect(r.xirr).toBeCloseTo(-0.2, 6);
    expect(Number.isFinite(r.xirr)).toBe(true);
    expect(Math.abs(r.xirr)).toBeLessThan(1); // sanity bound: no monthly-rate blowups
  });
});
