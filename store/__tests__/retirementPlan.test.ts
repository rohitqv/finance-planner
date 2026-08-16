import { describe, it, expect, beforeEach } from "vitest";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import type { RetirementInput } from "@/lib/finance/retirement";

beforeEach(() => localStorage.clear());

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

describe("retirement plan store", () => {
  it("returns null when empty", () => {
    expect(loadPlan()).toBeNull();
  });
  it("round-trips a plan", () => {
    savePlan(plan);
    expect(loadPlan()?.retirementAge).toBe(55);
  });
});
