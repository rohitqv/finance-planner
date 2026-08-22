import { describe, it, expect } from "vitest";
import { computeReturns } from "@/lib/finance/returns";
import type { CalculatorInput } from "@/lib/finance/types";

const base: CalculatorInput = {
  lumpsum: 0, monthlySip: 0, stepUpPct: 0,
  annualReturn: 12, years: 10, inflationPct: 0,
};

describe("computeReturns — pure lumpsum", () => {
  it("XIRR equals the input rate", () => {
    const r = computeReturns({ ...base, lumpsum: 1_000_000, monthlySip: 0 });
    expect(r.xirr).toBeCloseTo(0.12, 4);
  });
});

describe("computeReturns — pure SIP", () => {
  // The case that retired CAGR: a contribution stream compounding at exactly
  // 12% has an XIRR of 12%, while (FV / totalInvested)^(1/years) - 1 reports
  // 6.63% for the same scenario. XIRR is the one that tracks the input.
  it("XIRR tracks the input rate for a contribution stream", () => {
    const r = computeReturns({ ...base, monthlySip: 10_000, annualReturn: 12 });
    expect(r.xirr).toBeCloseTo(0.12, 2);
  });
});

describe("computeReturns — zero investment", () => {
  it("XIRR is 0 when there is no lumpsum and no SIP", () => {
    const r = computeReturns({ ...base, lumpsum: 0, monthlySip: 0 });
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

  // These three cover cashflow shapes the two tests above don't touch —
  // each failed differently against the old Newton-Raphson code (a
  // lumpsum pinned at the -99.99% floor, a mixed lumpsum+SIP blowup to
  // 1e+172, and a positive step-up combined with a negative return
  // blowing up to 1e+99) — so each guards against a distinct regression,
  // not just the SIP-only blow-up mode already covered.
  it("XIRR tracks a -20% input for a pure lumpsum (no SIP)", () => {
    const r = computeReturns({ ...base, lumpsum: 1_000_000, monthlySip: 0, annualReturn: -20, years: 15 });
    expect(r.xirr).toBeCloseTo(-0.2, 6);
  });

  it("XIRR tracks a -20% input for a mixed lumpsum + SIP", () => {
    const r = computeReturns({ ...base, lumpsum: 500_000, monthlySip: 10_000, annualReturn: -20, years: 15 });
    expect(r.xirr).toBeCloseTo(-0.2, 6);
  });

  it("XIRR stays finite and sane for a stepped-up SIP with a negative return", () => {
    const r = computeReturns({ ...base, monthlySip: 10_000, stepUpPct: 10, annualReturn: -20, years: 15 });
    expect(Number.isFinite(r.xirr)).toBe(true);
    expect(r.xirr).toBeLessThan(0);
    expect(Math.abs(r.xirr)).toBeLessThan(1);
  });
});
