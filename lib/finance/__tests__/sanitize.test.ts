import { describe, it, expect } from "vitest";
import {
  sanitizeAssetClasses, sanitizeCalculatorInput, sanitizePhases,
  sanitizeRetirementInput, sanitizeScenario, sanitizeScenarios,
} from "@/lib/finance/sanitize";
import { DEFAULT_CALCULATOR_INPUT, DEFAULT_RETIREMENT_INPUT } from "@/lib/finance/defaults";

describe("sanitizeRetirementInput", () => {
  it("returns the defaults for junk input", () => {
    expect(sanitizeRetirementInput(null)).toEqual(DEFAULT_RETIREMENT_INPUT);
    expect(sanitizeRetirementInput("nope")).toEqual(DEFAULT_RETIREMENT_INPUT);
    expect(sanitizeRetirementInput([])).toEqual(DEFAULT_RETIREMENT_INPUT);
  });

  it("keeps valid saved numbers", () => {
    const plan = sanitizeRetirementInput({ ...DEFAULT_RETIREMENT_INPUT, currentAge: 41, preReturnPct: 9.5 });
    expect(plan.currentAge).toBe(41);
    expect(plan.preReturnPct).toBe(9.5);
  });

  // JSON.stringify turns NaN and Infinity into `null`, so a plan saved while
  // a field was mid-edit reads back as null — which used to be cast straight
  // to `number` and handed to the engines.
  it("repairs a null left behind by a JSON round-trip", () => {
    const roundTripped = JSON.parse(JSON.stringify({ ...DEFAULT_RETIREMENT_INPUT, currentAge: NaN }));
    expect(roundTripped.currentAge).toBeNull();
    expect(sanitizeRetirementInput(roundTripped).currentAge).toBe(DEFAULT_RETIREMENT_INPUT.currentAge);
  });

  it("rejects a string where a number belongs", () => {
    const plan = sanitizeRetirementInput({ ...DEFAULT_RETIREMENT_INPUT, retirementAge: "60" });
    expect(plan.retirementAge).toBe(DEFAULT_RETIREMENT_INPUT.retirementAge);
  });

  it("fills in a field that did not exist when the plan was saved", () => {
    const older: Record<string, unknown> = { ...DEFAULT_RETIREMENT_INPUT };
    delete older.sipStepUpPct;
    expect(sanitizeRetirementInput(older).sipStepUpPct).toBe(0);
  });

  it("always produces finite numbers for every numeric field", () => {
    const plan = sanitizeRetirementInput({ currentAge: NaN, lifespanAge: Infinity, bucketYears: "x" });
    for (const [key, value] of Object.entries(plan)) {
      if (typeof value === "number") expect(Number.isFinite(value), key).toBe(true);
    }
  });

  it("keeps a boolean flag but ignores a non-boolean one", () => {
    expect(sanitizeRetirementInput({ useBucketStrategy: true }).useBucketStrategy).toBe(true);
    expect(sanitizeRetirementInput({ useBucketStrategy: "yes" }).useBucketStrategy).toBe(false);
  });
});

describe("sanitizePhases", () => {
  it("drops non-array and non-object entries", () => {
    expect(sanitizePhases("nope")).toEqual([]);
    expect(sanitizePhases([null, 5, "x"])).toEqual([]);
  });

  it("keeps well-formed phases and repairs broken numbers", () => {
    expect(sanitizePhases([{ fromAge: 70, toAge: 85, monthlyExpenseToday: null }])).toEqual([
      { fromAge: 70, toAge: 85, monthlyExpenseToday: 0 },
    ]);
  });
});

describe("sanitizeAssetClasses", () => {
  it("fills the whole fixed set when nothing is saved", () => {
    expect(sanitizeAssetClasses(undefined)).toEqual(DEFAULT_RETIREMENT_INPUT.assetClasses);
  });

  it("keeps a saved amount for a known key", () => {
    const saved = [{ key: "gold", amount: 250000, ratePct: 9, includeInRetirement: false }];
    const gold = sanitizeAssetClasses(saved).find((a) => a.key === "gold");
    expect(gold).toMatchObject({ amount: 250000, ratePct: 9, includeInRetirement: false });
  });

  it("ignores a key that is no longer part of the fixed set", () => {
    const result = sanitizeAssetClasses([{ key: "crypto", amount: 1, ratePct: 1 }]);
    expect(result.map((a) => a.key)).toEqual(DEFAULT_RETIREMENT_INPUT.assetClasses.map((a) => a.key));
  });

  it("repairs a broken amount without discarding the rest of the class", () => {
    const result = sanitizeAssetClasses([{ key: "epfo", amount: null, ratePct: 8.25 }]);
    const epfo = result.find((a) => a.key === "epfo");
    expect(epfo?.amount).toBe(0);
    expect(epfo?.ratePct).toBe(8.25);
  });
});

describe("sanitizeCalculatorInput", () => {
  it("falls back per field, keeping the good ones", () => {
    const input = sanitizeCalculatorInput({ monthlySip: 25000, years: Infinity });
    expect(input.monthlySip).toBe(25000);
    expect(input.years).toBe(DEFAULT_CALCULATOR_INPUT.years);
  });

  it("handles a missing object entirely", () => {
    expect(sanitizeCalculatorInput(undefined)).toEqual(DEFAULT_CALCULATOR_INPUT);
  });
});

describe("sanitizeScenario", () => {
  const good = {
    id: "abc", name: "Base", lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
    annualReturn: 12, years: 15, inflationPct: 6, createdAt: 1,
  };

  it("keeps a well-formed scenario", () => {
    expect(sanitizeScenario(good)).toMatchObject({ id: "abc", name: "Base", monthlySip: 10000 });
  });

  // A row with no id can't be deleted or duplicated from the table, so it is
  // dropped rather than repaired into an unmanageable entry.
  it("drops a scenario missing an id or name", () => {
    expect(sanitizeScenario({ ...good, id: undefined })).toBeNull();
    expect(sanitizeScenario({ ...good, name: "" })).toBeNull();
  });

  it("repairs broken numbers so the scenario table never renders NaN", () => {
    const s = sanitizeScenario({ ...good, annualReturn: "twelve" });
    expect(s?.annualReturn).toBe(DEFAULT_CALCULATOR_INPUT.annualReturn);
  });

  it("keeps a finite corpus goal and drops a broken one", () => {
    expect(sanitizeScenario({ ...good, corpusGoal: 5_000_000 })?.corpusGoal).toBe(5_000_000);
    expect(sanitizeScenario({ ...good, corpusGoal: null })?.corpusGoal).toBeUndefined();
  });

  it("filters unusable rows out of a list instead of failing the whole read", () => {
    expect(sanitizeScenarios([good, null, { name: "no id" }])).toHaveLength(1);
    expect(sanitizeScenarios("not a list")).toEqual([]);
  });
});
