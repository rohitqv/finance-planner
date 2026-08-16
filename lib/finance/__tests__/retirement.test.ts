import { describe, it, expect } from "vitest";
import { computeRetirement, computeAccumulationSplit, requiredSip, type RetirementInput } from "@/lib/finance/retirement";
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

  it("with zero years and an unmet target, is explicitly Infinity (unreachable via SIP), never NaN", () => {
    // years=0 means there is no time for any monthly SIP to accumulate,
    // so no finite SIP amount can close a positive gap. This must be an
    // intentional, guarded Infinity — not an accidental 0/0 -> NaN or an
    // unannotated division artifact.
    const sip = requiredSip(10_000_000, 0, 12, 0);
    expect(sip).toBe(Infinity);
    expect(Number.isNaN(sip)).toBe(false);
  });

  it("with zero years and a corpus that already meets the target, returns 0 (not masked by the Infinity path)", () => {
    const sip = requiredSip(10_000_000, 0, 12, 10_000_000);
    expect(sip).toBe(0);
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

describe("computeRetirement — zero accumulation years", () => {
  it("currentAge === retirementAge yields no NaN and an explicit Infinity requiredMonthlySip when underfunded", () => {
    const r = computeRetirement({ ...base, currentAge: 55, retirementAge: 55, currentCorpus: 0 });
    expect(Number.isNaN(r.requiredMonthlySip)).toBe(false);
    expect(Number.isNaN(r.extraSipToCloseGap)).toBe(false);
    // Zero years to accumulate and an unmet target: no SIP amount, however
    // large, can close the gap in zero time.
    expect(r.requiredMonthlySip).toBe(Infinity);
  });

  it("currentAge === retirementAge with a corpus already covering the target yields 0, not Infinity", () => {
    const r = computeRetirement({ ...base, currentAge: 55, retirementAge: 55, currentCorpus: 1_000_000_000 });
    expect(Number.isNaN(r.requiredMonthlySip)).toBe(false);
    expect(r.requiredMonthlySip).toBe(0);
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

describe("computeAccumulationSplit", () => {
  it("the Required series lands on the corpus target in its final year", () => {
    const input = { ...base, currentCorpus: 2_000_000 };
    const r = computeRetirement(input);
    const split = computeAccumulationSplit(input, r.requiredMonthlySip);
    const accumYears = input.retirementAge - input.currentAge;
    expect(split.required).toHaveLength(accumYears);
    expect(split.required[accumYears - 1].value).toBeCloseTo(r.corpusNeededAtRetirement, -1);
  });

  it("returns null surplus when there is no surplus", () => {
    const split = computeAccumulationSplit(
      { ...base, currentMonthlyInvestment: 0 }, 50_000,
    );
    expect(split.surplus).toBeNull();
  });

  it("returns a surplus series sized to the excess over the required SIP", () => {
    const requiredSipAmount = 50_000;
    const split = computeAccumulationSplit(
      { ...base, currentMonthlyInvestment: 80_000 }, requiredSipAmount,
    );
    expect(split.surplus).not.toBeNull();
    const accumYears = base.retirementAge - base.currentAge;
    const expectedSurplusFv = accumulate({
      lumpsum: 0, monthlySip: 30_000, stepUpPct: 0,
      annualReturn: base.preReturnPct, years: accumYears, inflationPct: 0,
    }).futureValue;
    expect(split.surplus![accumYears - 1].value).toBeCloseTo(expectedSurplusFv, -1);
  });

  it("returns empty series when there are zero or negative years to retirement", () => {
    const split = computeAccumulationSplit(
      { ...base, retirementAge: base.currentAge }, 50_000,
    );
    expect(split.required).toEqual([]);
    expect(split.surplus).toBeNull();
  });

  it("returns empty series when requiredMonthlySip is not finite", () => {
    const split = computeAccumulationSplit(base, Infinity);
    expect(split.required).toEqual([]);
    expect(split.surplus).toBeNull();
  });
});
