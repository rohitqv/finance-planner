import { describe, it, expect, beforeEach } from "vitest";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const KEY = "finance-planner:retirement:v1";

beforeEach(() => localStorage.clear());

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0, sipStepUpPct: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};

describe("retirement plan store", () => {
  it("returns null when empty", () => {
    expect(loadPlan()).toBeNull();
  });

  it("round-trips a plan", () => {
    savePlan(plan);
    expect(loadPlan()?.retirementAge).toBe(55);
    expect(loadPlan()?.assetClasses).toEqual(DEFAULT_ASSET_CLASSES);
  });

  it("migrates an old-shape saved plan (currentCorpus, no assetClasses) into the new asset-class shape", () => {
    const legacy = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 10, postReturnPct: 8,
      phases: [], currentCorpus: 500_000, currentMonthlyInvestment: 20_000,
    };
    localStorage.setItem(KEY, JSON.stringify(legacy));

    const loaded = loadPlan();
    expect(loaded).not.toBeNull();
    expect(loaded!.assetClasses).toHaveLength(5);

    const mutualFund = loaded!.assetClasses.find((a) => a.key === "mutualFund")!;
    expect(mutualFund.amount).toBe(500_000);
    expect(mutualFund.ratePct).toBe(10); // old preReturnPct
    expect(mutualFund.includeInRetirement).toBe(true);

    const gold = loaded!.assetClasses.find((a) => a.key === "gold")!;
    expect(gold.amount).toBe(0);
    expect(gold.includeInRetirement).toBe(true);

    // Non-asset-class fields pass through untouched.
    expect(loaded!.currentMonthlyInvestment).toBe(20_000);
    expect(loaded!.retirementAge).toBe(55);
  });

  it("migrating a legacy plan with no currentCorpus at all defaults the mutual fund amount to 0", () => {
    const legacy = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
      phases: [], currentMonthlyInvestment: 0,
    };
    localStorage.setItem(KEY, JSON.stringify(legacy));

    const loaded = loadPlan();
    const mutualFund = loaded!.assetClasses.find((a) => a.key === "mutualFund")!;
    expect(mutualFund.amount).toBe(0);
  });

  it("migrates a plan with a malformed assetClasses value (not an array) instead of crashing downstream", () => {
    const corrupted = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
      phases: [], assetClasses: "not-an-array", currentMonthlyInvestment: 0,
    };
    localStorage.setItem(KEY, JSON.stringify(corrupted));

    const loaded = loadPlan();
    expect(loaded).not.toBeNull();
    expect(Array.isArray(loaded!.assetClasses)).toBe(true);
    expect(loaded!.assetClasses).toHaveLength(5);
  });

  it("migrates a plan with an empty assetClasses array instead of passing it through with zero classes", () => {
    const partial = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
      phases: [], assetClasses: [], currentMonthlyInvestment: 0,
    };
    localStorage.setItem(KEY, JSON.stringify(partial));

    const loaded = loadPlan();
    expect(loaded!.assetClasses).toHaveLength(5);
  });

  it("adds a newly-introduced asset class (Fixed Deposit) to a plan saved under the older 4-class shape, without touching the other classes' saved amounts", () => {
    const olderShapePlan = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
      phases: [], currentMonthlyInvestment: 0,
      assetClasses: [
        { key: "mutualFund", label: "Mutual Fund", amount: 300_000, ratePct: 12, includeInRetirement: true },
        { key: "gold", label: "Gold", amount: 50_000, ratePct: 8, includeInRetirement: false },
        { key: "epfo", label: "EPFO", amount: 400_000, ratePct: 8.25, includeInRetirement: true },
        { key: "realEstate", label: "Real Estate", amount: 9_000_000, ratePct: 8, includeInRetirement: true },
      ],
    };
    localStorage.setItem(KEY, JSON.stringify(olderShapePlan));

    const loaded = loadPlan();
    expect(loaded!.assetClasses).toHaveLength(5);

    // The 4 previously-saved classes keep their exact saved values.
    expect(loaded!.assetClasses.find((a) => a.key === "mutualFund")).toEqual(olderShapePlan.assetClasses[0]);
    expect(loaded!.assetClasses.find((a) => a.key === "gold")).toEqual(olderShapePlan.assetClasses[1]);
    expect(loaded!.assetClasses.find((a) => a.key === "epfo")).toEqual(olderShapePlan.assetClasses[2]);
    expect(loaded!.assetClasses.find((a) => a.key === "realEstate")).toEqual(olderShapePlan.assetClasses[3]);

    // Fixed Deposit is newly added at its default, not silently dropped.
    const fixedDeposit = loaded!.assetClasses.find((a) => a.key === "fixedDeposit")!;
    expect(fixedDeposit.amount).toBe(0);
    expect(fixedDeposit.includeInRetirement).toBe(true);
  });

  it("backfills bucket-strategy defaults for a plan saved before that feature shipped", () => {
    const preFeaturePlan = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
      phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
    };
    localStorage.setItem(KEY, JSON.stringify(preFeaturePlan));

    const loaded = loadPlan();
    expect(loaded!.useBucketStrategy).toBe(false);
    expect(loaded!.bucketYears).toBe(5);
    expect(loaded!.safeBucketRatePct).toBe(7);
    expect(loaded!.growthBucketRatePct).toBe(11);
  });

  it("keeps a saved bucket-strategy setting rather than overwriting it with the default", () => {
    const planWithBuckets = {
      ...plan, useBucketStrategy: true, bucketYears: 3, safeBucketRatePct: 6, growthBucketRatePct: 12,
    };
    localStorage.setItem(KEY, JSON.stringify(planWithBuckets));

    const loaded = loadPlan();
    expect(loaded!.useBucketStrategy).toBe(true);
    expect(loaded!.bucketYears).toBe(3);
    expect(loaded!.safeBucketRatePct).toBe(6);
    expect(loaded!.growthBucketRatePct).toBe(12);
  });
});
