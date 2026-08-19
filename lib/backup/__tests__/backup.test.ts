import { describe, it, expect } from "vitest";
import { buildBackupPayload, parseBackupPayload, mergeImportedScenarios } from "@/lib/backup/backup";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";
import type { Scenario } from "@/store/scenarios";

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0, sipStepUpPct: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};

const scenario: Scenario = {
  id: "s1", name: "Base case", lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6, createdAt: 1000,
};

describe("buildBackupPayload", () => {
  it("includes only the parts provided", () => {
    const planOnly = buildBackupPayload({ retirementPlan: plan });
    expect(planOnly.retirementPlan).toEqual(plan);
    expect(planOnly.scenarios).toBeUndefined();

    const scenariosOnly = buildBackupPayload({ scenarios: [scenario] });
    expect(scenariosOnly.scenarios).toEqual([scenario]);
    expect(scenariosOnly.retirementPlan).toBeUndefined();

    const both = buildBackupPayload({ retirementPlan: plan, scenarios: [scenario] });
    expect(both.retirementPlan).toEqual(plan);
    expect(both.scenarios).toEqual([scenario]);
  });

  it("always sets version 1 and an ISO exportedAt timestamp", () => {
    const payload = buildBackupPayload({});
    expect(payload.version).toBe(1);
    expect(new Date(payload.exportedAt).toISOString()).toBe(payload.exportedAt);
  });
});

describe("parseBackupPayload", () => {
  it("round-trips a payload built by buildBackupPayload", () => {
    const built = buildBackupPayload({ retirementPlan: plan, scenarios: [scenario] });
    const parsed = parseBackupPayload(JSON.stringify(built));
    expect(parsed).toEqual(built);
  });

  it("accepts a plan-only payload", () => {
    const built = buildBackupPayload({ retirementPlan: plan });
    expect(() => parseBackupPayload(JSON.stringify(built))).not.toThrow();
  });

  it("accepts a scenarios-only payload", () => {
    const built = buildBackupPayload({ scenarios: [scenario] });
    expect(() => parseBackupPayload(JSON.stringify(built))).not.toThrow();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseBackupPayload("{not json")).toThrow();
  });

  it("throws when version is missing or wrong", () => {
    expect(() => parseBackupPayload(JSON.stringify({ exportedAt: "x" }))).toThrow();
    expect(() => parseBackupPayload(JSON.stringify({ version: 2, exportedAt: "x" }))).toThrow();
  });

  it("throws when retirementPlan is present but malformed (no assetClasses array)", () => {
    const bad = { version: 1, exportedAt: "x", retirementPlan: { currentAge: 30 } };
    expect(() => parseBackupPayload(JSON.stringify(bad))).toThrow();
  });

  it("throws when scenarios is present but malformed (entry missing name)", () => {
    const bad = { version: 1, exportedAt: "x", scenarios: [{ lumpsum: 0 }] };
    expect(() => parseBackupPayload(JSON.stringify(bad))).toThrow();
  });
});

describe("mergeImportedScenarios", () => {
  it("appends imported scenarios to the existing list", () => {
    const merged = mergeImportedScenarios([scenario], [{ ...scenario, id: "s2", name: "Imported" }]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(scenario);
    expect(merged[1].name).toBe("Imported");
  });

  it("always assigns a fresh id to every imported scenario, never trusting the file's id", () => {
    const merged = mergeImportedScenarios([], [{ ...scenario, id: "s1" }]);
    expect(merged[0].id).not.toBe("s1");
    expect(merged[0].id).toBeTruthy();
  });

  it("never collides with an existing scenario's id even if the imported file reuses it", () => {
    const merged = mergeImportedScenarios([scenario], [{ ...scenario, id: scenario.id, name: "Duplicate id in file" }]);
    const ids = merged.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("handles an empty existing list", () => {
    const merged = mergeImportedScenarios([], [scenario]);
    expect(merged).toHaveLength(1);
  });
});
