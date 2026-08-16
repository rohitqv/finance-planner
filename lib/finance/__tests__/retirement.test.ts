import { describe, it, expect } from "vitest";
import { computeRetirement, requiredSip, type RetirementInput } from "@/lib/finance/retirement";
import { accumulate } from "@/lib/finance/accumulation";

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50_000, inflationPct: 6,
  preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

describe("requiredSip", () => {
  it("solves a SIP that reaches the target with zero starting corpus", () => {
    const sip = requiredSip(10_000_000, 25, 12, 0);
    const fv = accumulate({
      lumpsum: 0, monthlySip: sip, stepUpPct: 0,
      annualReturn: 12, years: 25, inflationPct: 0,
    }).futureValue;
    expect(fv).toBeCloseTo(10_000_000, -1); // within ~10 rupees
  });
  it("reduces the required SIP when a starting corpus is present", () => {
    const none = requiredSip(10_000_000, 25, 12, 0);
    const some = requiredSip(10_000_000, 25, 12, 1_000_000);
    expect(some).toBeLessThan(none);
  });
});

describe("computeRetirement — corpus depletion round-trip", () => {
  it("a corpus equal to corpusNeededAtRetirement depletes to ~0 at lifespan", () => {
    const r = computeRetirement(base);
    // Re-simulate drawdown at postReturn using the reported inflated expenses.
    const i = base.postReturnPct / 100;
    let bal = r.corpusNeededAtRetirement;
    for (const row of r.drawdown) {
      bal = (bal - row.annualExpenseInflated) * (1 + i); // withdraw at year start, then grow
    }
    expect(Math.abs(bal)).toBeLessThan(r.corpusNeededAtRetirement * 0.001);
  });

  it("required SIP with zero current corpus reproduces the corpus at retirement", () => {
    const r = computeRetirement(base);
    const fv = accumulate({
      lumpsum: 0, monthlySip: r.requiredMonthlySip, stepUpPct: 0,
      annualReturn: base.preReturnPct, years: base.retirementAge - base.currentAge, inflationPct: 0,
    }).futureValue;
    expect(fv).toBeCloseTo(r.corpusNeededAtRetirement, -1);
  });

  it("gap is positive (shortfall) when current plan underfunds", () => {
    const r = computeRetirement({ ...base, currentMonthlyInvestment: 5_000 });
    expect(r.gap).toBeGreaterThan(0);
    expect(r.extraSipToCloseGap).toBeGreaterThan(0);
  });
});

describe("computeRetirement — phases", () => {
  it("lower late-life expense reduces the corpus needed", () => {
    const withPhase = computeRetirement({
      ...base,
      phases: [{ fromAge: 70, toAge: 85, monthlyExpenseToday: 30_000 }],
    });
    const withoutPhase = computeRetirement(base);
    expect(withPhase.corpusNeededAtRetirement).toBeLessThan(withoutPhase.corpusNeededAtRetirement);
  });
});
