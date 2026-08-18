import { describe, it, expect } from "vitest";
import {
  computeRetirement, computeAccumulationSplit, requiredSip,
  includedCorpusFutureValue, includedCorpusAmount,
  simulateBucketDrawdown, isBucketDrawdown, solveBucketCorpusNeeded,
  DEFAULT_ASSET_CLASSES, type RetirementInput, type AssetClass,
} from "@/lib/finance/retirement";
import { accumulate } from "@/lib/finance/accumulation";

function corpusOf(amount: number, ratePct = 12): AssetClass[] {
  return DEFAULT_ASSET_CLASSES.map((a) =>
    a.key === "mutualFund" ? { ...a, amount, ratePct } : a,
  );
}

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50_000, inflationPct: 6,
  preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
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
    const r = computeRetirement({ ...base, currentAge: 55, retirementAge: 55 });
    expect(Number.isNaN(r.requiredMonthlySip)).toBe(false);
    expect(Number.isNaN(r.extraSipToCloseGap)).toBe(false);
    // Zero years to accumulate and an unmet target: no SIP amount, however
    // large, can close the gap in zero time.
    expect(r.requiredMonthlySip).toBe(Infinity);
  });

  it("currentAge === retirementAge with a corpus already covering the target yields 0, not Infinity", () => {
    const r = computeRetirement({
      ...base, currentAge: 55, retirementAge: 55,
      assetClasses: corpusOf(1_000_000_000, base.preReturnPct),
    });
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
    const input = { ...base, assetClasses: corpusOf(2_000_000, base.preReturnPct) };
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

  it("required series sums each included class at its own rate (not the blended SIP rate) and omits excluded classes", () => {
    const accumYears = base.retirementAge - base.currentAge;
    const mutualFundAmount = 1_000_000;
    const epfoAmount = 1_000_000;
    const requiredMonthlySip = 20_000;
    const input: RetirementInput = {
      ...base,
      assetClasses: [
        { key: "mutualFund", label: "Mutual Fund", amount: mutualFundAmount, ratePct: 12, includeInRetirement: true },
        { key: "gold", label: "Gold", amount: 0, ratePct: 8, includeInRetirement: true },
        { key: "epfo", label: "EPFO", amount: epfoAmount, ratePct: 8.25, includeInRetirement: true },
        { key: "realEstate", label: "Real Estate", amount: 5_000_000, ratePct: 8, includeInRetirement: false },
      ],
    };
    const split = computeAccumulationSplit(input, requiredMonthlySip);

    const mfFv = accumulate({
      lumpsum: mutualFundAmount, monthlySip: 0, stepUpPct: 0,
      annualReturn: 12, years: accumYears, inflationPct: 0,
    }).futureValue;
    const epfoFv = accumulate({
      lumpsum: epfoAmount, monthlySip: 0, stepUpPct: 0,
      annualReturn: 8.25, years: accumYears, inflationPct: 0,
    }).futureValue;
    const sipFv = accumulate({
      lumpsum: 0, monthlySip: requiredMonthlySip, stepUpPct: 0,
      annualReturn: base.preReturnPct, years: accumYears, inflationPct: 0,
    }).futureValue;

    // Excluded Real Estate (5,000,000 @ 8%) is not part of this sum — if it
    // leaked in, or if Mutual Fund / EPFO were grown at the blended
    // preReturnPct (12%) instead of their own rates, this would diverge.
    expect(split.required[accumYears - 1].value).toBeCloseTo(mfFv + epfoFv + sipFv, 6);
  });
});

describe("includedCorpusFutureValue", () => {
  it("sums each included asset class grown at its own rate", () => {
    const classes: AssetClass[] = [
      { key: "mutualFund", label: "Mutual Fund", amount: 100_000, ratePct: 12, includeInRetirement: true },
      { key: "epfo", label: "EPFO", amount: 200_000, ratePct: 8.25, includeInRetirement: true },
    ];
    const years = 10;
    const expected =
      accumulate({ lumpsum: 100_000, monthlySip: 0, stepUpPct: 0, annualReturn: 12, years, inflationPct: 0 }).futureValue +
      accumulate({ lumpsum: 200_000, monthlySip: 0, stepUpPct: 0, annualReturn: 8.25, years, inflationPct: 0 }).futureValue;
    expect(includedCorpusFutureValue(classes, years)).toBeCloseTo(expected, 6);
  });

  it("excludes asset classes with includeInRetirement: false entirely", () => {
    const classes: AssetClass[] = [
      { key: "mutualFund", label: "Mutual Fund", amount: 100_000, ratePct: 12, includeInRetirement: true },
      { key: "realEstate", label: "Real Estate", amount: 5_000_000, ratePct: 8, includeInRetirement: false },
    ];
    const years = 10;
    const withoutRealEstate = accumulate({
      lumpsum: 100_000, monthlySip: 0, stepUpPct: 0, annualReturn: 12, years, inflationPct: 0,
    }).futureValue;
    expect(includedCorpusFutureValue(classes, years)).toBeCloseTo(withoutRealEstate, 6);
  });
});

describe("includedCorpusAmount", () => {
  it("sums today's amount for included classes only", () => {
    const classes: AssetClass[] = [
      { key: "mutualFund", label: "Mutual Fund", amount: 100_000, ratePct: 12, includeInRetirement: true },
      { key: "gold", label: "Gold", amount: 50_000, ratePct: 8, includeInRetirement: false },
      { key: "epfo", label: "EPFO", amount: 300_000, ratePct: 8.25, includeInRetirement: true },
    ];
    expect(includedCorpusAmount(classes)).toBe(400_000);
  });
});

describe("computeRetirement — excluded asset classes are invisible to calculations", () => {
  it("an excluded high-value asset class does not reduce requiredMonthlySip or raise projectedCorpusFromCurrentPlan", () => {
    const excluded = computeRetirement({
      ...base,
      assetClasses: DEFAULT_ASSET_CLASSES.map((a) =>
        a.key === "realEstate" ? { ...a, amount: 50_000_000, includeInRetirement: false } : a,
      ),
    });
    const zero = computeRetirement(base);
    expect(excluded.requiredMonthlySip).toBeCloseTo(zero.requiredMonthlySip, 6);
    expect(excluded.projectedCorpusFromCurrentPlan).toBeCloseTo(zero.projectedCorpusFromCurrentPlan, 6);
  });

  it("the same asset class included instead of excluded does reduce requiredMonthlySip", () => {
    const included = computeRetirement({
      ...base,
      assetClasses: DEFAULT_ASSET_CLASSES.map((a) =>
        a.key === "realEstate" ? { ...a, amount: 50_000_000, includeInRetirement: true } : a,
      ),
    });
    const zero = computeRetirement(base);
    expect(included.requiredMonthlySip).toBeLessThan(zero.requiredMonthlySip);
  });
});

describe("simulateBucketDrawdown", () => {
  // A small, hand-computable scenario: 3 years of retirement (60, 61, 62),
  // flat (uninflated) expense so every year withdraws exactly 12,00,000,
  // round rates so the arithmetic is easy to verify by hand.
  const bucketBase: RetirementInput = {
    ...base,
    currentAge: 60, retirementAge: 60, lifespanAge: 62,
    currentMonthlyExpense: 100_000, inflationPct: 0,
    useBucketStrategy: true, bucketYears: 2, safeBucketRatePct: 10, growthBucketRatePct: 20,
  };

  it("withdraws from the safe bucket, grows both buckets, and refills the safe bucket from growth (hand-computed)", () => {
    // Initial split of 50,00,000: safe = 2 years' expense = 24,00,000, growth = 26,00,000.
    // Year 60: safe (24L-12L)*1.10=13.2L, growth 26L*1.20=31.2L, refill target
    //   (next 2 yrs) = 24L, transfer 10.8L growth->safe => safe 24L, growth 20.4L.
    // Year 61: safe (24L-12L)*1.10=13.2L, growth 20.4L*1.20=24.48L, refill
    //   target (next 1 yr) = 12L, transfer -1.2L (safe->growth) => safe 12L, growth 25.68L.
    // Year 62 (last): safe (12L-12L)*1.10=0, growth 25.68L*1.20=30.816L, refill
    //   target (0 yrs left) = 0, no transfer => safe 0, growth 30.816L.
    const rows = simulateBucketDrawdown(bucketBase, 5_000_000);
    expect(rows).toHaveLength(3);

    expect(rows[0].age).toBe(60);
    expect(rows[0].safeBalance).toBeCloseTo(2_400_000, 0);
    expect(rows[0].growthBalance).toBeCloseTo(2_040_000, 0);

    expect(rows[1].age).toBe(61);
    expect(rows[1].safeBalance).toBeCloseTo(1_200_000, 0);
    expect(rows[1].growthBalance).toBeCloseTo(2_568_000, 0);

    expect(rows[2].age).toBe(62);
    expect(rows[2].safeBalance).toBeCloseTo(0, 0);
    expect(rows[2].growthBalance).toBeCloseTo(3_081_600, 0);
    expect(rows[2].corpusBalance).toBeCloseTo(3_081_600, 0);
  });

  it("floors both buckets at 0 when the starting corpus can't cover expenses, instead of going negative", () => {
    const rows = simulateBucketDrawdown(bucketBase, 0);
    for (const row of rows) {
      expect(row.safeBalance).toBeGreaterThanOrEqual(0);
      expect(row.growthBalance).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("isBucketDrawdown", () => {
  it("distinguishes bucket rows from flat-rate rows", () => {
    const bucketBase: RetirementInput = {
      ...base,
      currentAge: 60, retirementAge: 60, lifespanAge: 62,
      currentMonthlyExpense: 100_000, inflationPct: 0,
      useBucketStrategy: true, bucketYears: 2, safeBucketRatePct: 10, growthBucketRatePct: 20,
    };
    expect(isBucketDrawdown(simulateBucketDrawdown(bucketBase, 5_000_000))).toBe(true);
    expect(isBucketDrawdown(computeRetirement(base).drawdown)).toBe(false);
    expect(isBucketDrawdown([])).toBe(false);
  });
});

describe("solveBucketCorpusNeeded", () => {
  const bucketBase: RetirementInput = {
    ...base,
    currentAge: 60, retirementAge: 60, lifespanAge: 62,
    currentMonthlyExpense: 100_000, inflationPct: 0,
    useBucketStrategy: true, bucketYears: 2, safeBucketRatePct: 10, growthBucketRatePct: 20,
  };

  it("solves a starting corpus that depletes to ~0 exactly at lifespanAge", () => {
    const corpus = solveBucketCorpusNeeded(bucketBase);
    const rows = simulateBucketDrawdown(bucketBase, corpus);
    expect(rows[rows.length - 1].corpusBalance).toBeCloseTo(0, 0);
  });

  it("a larger starting corpus than the solved amount ends with money left over", () => {
    const corpus = solveBucketCorpusNeeded(bucketBase);
    const rows = simulateBucketDrawdown(bucketBase, corpus + 1_000_000);
    expect(rows[rows.length - 1].corpusBalance).toBeGreaterThan(0);
  });

  it("returns 0 when lifespanAge is before retirementAge, instead of crashing", () => {
    const invalid: RetirementInput = { ...bucketBase, lifespanAge: 59 };
    expect(solveBucketCorpusNeeded(invalid)).toBe(0);
  });

  it("converges for a realistic multi-decade horizon (30 years)", () => {
    const longHorizon: RetirementInput = {
      ...base, useBucketStrategy: true, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
    };
    const corpus = solveBucketCorpusNeeded(longHorizon);
    expect(corpus).toBeGreaterThan(0);
    const rows = simulateBucketDrawdown(longHorizon, corpus);
    expect(rows[rows.length - 1].corpusBalance).toBeCloseTo(0, -2); // within ~50 rupees
  });
});
