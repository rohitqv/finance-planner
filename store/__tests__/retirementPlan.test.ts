import { describe, it, expect, beforeEach } from "vitest";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const KEY = "finance-planner:retirement:v1";

beforeEach(() => localStorage.clear());

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
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
    expect(loaded!.assetClasses).toHaveLength(4);

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
});
