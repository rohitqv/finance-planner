import { describe, it, expect } from "vitest";
import {
  CALCULATOR_FIELD_SPECS,
  RETIREMENT_FIELD_SPECS,
  validateAssetClasses,
  validateCalculatorInput,
  validateField,
  validatePhases,
  validateRetirementInput,
} from "@/lib/finance/validation";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";
import type { CalculatorInput } from "@/lib/finance/types";

const validCalc: CalculatorInput = {
  lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6,
};

const validPlan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0, sipStepUpPct: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};

describe("validateField", () => {
  const spec = { label: "Years", min: 1, max: 100, integer: true };

  it("rejects NaN, which is what an emptied input box parses to", () => {
    expect(validateField(NaN, spec)).toBe("Enter a number.");
  });

  it("rejects Infinity rather than treating it as a very large number", () => {
    expect(validateField(Infinity, spec)).toBe("Enter a number.");
  });

  it("rejects a fractional value for an integer field", () => {
    expect(validateField(12.5, spec)).toBe("Must be a whole number.");
  });

  it("reports the bound that was crossed", () => {
    expect(validateField(0, spec)).toBe("Must be at least 1.");
    expect(validateField(101, spec)).toBe("Must be at most 100.");
  });

  it("accepts a value sitting exactly on a bound", () => {
    expect(validateField(1, spec)).toBeUndefined();
    expect(validateField(100, spec)).toBeUndefined();
  });

  it("formats large rupee bounds readably instead of as raw digits", () => {
    const money = { label: "Lumpsum", min: 0, max: 1e11 };
    expect(validateField(1e12, money)).toContain("₹1,00,00,00,00,000");
  });
});

describe("validateCalculatorInput", () => {
  it("passes a sane plan", () => {
    expect(validateCalculatorInput(validCalc).ok).toBe(true);
  });

  it("flags the offending field by key so it can render inline", () => {
    const result = validateCalculatorInput({ ...validCalc, years: 0 });
    expect(result.ok).toBe(false);
    expect(result.fields.years).toBe("Must be at least 1.");
    expect(result.fields.monthlySip).toBeUndefined();
  });

  // The XIRR solver in returns.ts documents that a step-up at or below -100%
  // flips the per-year SIP sign and breaks its single-sign-change
  // precondition. That gap was previously unguarded at the UI layer.
  it("rejects a step-up that would break the XIRR solver's sign precondition", () => {
    expect(validateCalculatorInput({ ...validCalc, stepUpPct: -100 }).ok).toBe(false);
    expect(validateCalculatorInput({ ...validCalc, stepUpPct: -150 }).ok).toBe(false);
    expect(validateCalculatorInput({ ...validCalc, stepUpPct: -50 }).ok).toBe(true);
  });

  it("rejects an inflation rate that would divide by zero in realValue", () => {
    expect(validateCalculatorInput({ ...validCalc, inflationPct: -100 }).ok).toBe(false);
  });

  it("asks for something to invest when both lumpsum and SIP are zero", () => {
    const result = validateCalculatorInput({ ...validCalc, lumpsum: 0, monthlySip: 0 });
    expect(result.ok).toBe(false);
    expect(result.form.join(" ")).toMatch(/nothing to grow/i);
  });
});

describe("validateRetirementInput", () => {
  it("passes the default plan", () => {
    expect(validateRetirementInput(validPlan).ok).toBe(true);
  });

  it("requires retirement age above current age", () => {
    const result = validateRetirementInput({ ...validPlan, retirementAge: 30 });
    expect(result.ok).toBe(false);
    expect(result.form.join(" ")).toMatch(/retirement age must be greater than current age/i);
  });

  it("requires lifespan above retirement age", () => {
    const result = validateRetirementInput({ ...validPlan, lifespanAge: 55 });
    expect(result.form.join(" ")).toMatch(/lifespan must be greater/i);
  });

  // A half-typed age should say "Enter a number", not complain about an
  // ordering the user cannot fix until the field holds a number at all.
  it("suppresses the ordering complaint while an age is still unparseable", () => {
    const result = validateRetirementInput({ ...validPlan, retirementAge: NaN });
    expect(result.fields.retirementAge).toBe("Enter a number.");
    expect(result.form.join(" ")).not.toMatch(/must be greater than current age/i);
  });

  it("ignores bucket fields while the bucket strategy is off", () => {
    const offPlan = { ...validPlan, useBucketStrategy: false, bucketYears: 0, safeBucketRatePct: NaN };
    expect(validateRetirementInput(offPlan).ok).toBe(true);
  });

  it("checks bucket fields once the bucket strategy is on", () => {
    const onPlan = { ...validPlan, useBucketStrategy: true, bucketYears: 0 };
    const result = validateRetirementInput(onPlan);
    expect(result.ok).toBe(false);
    expect(result.fields.bucketYears).toBe("Must be at least 1.");
  });

  it("rejects a bucket rate low enough to make the corpus solver return NaN", () => {
    const onPlan = { ...validPlan, useBucketStrategy: true, growthBucketRatePct: -100 };
    expect(validateRetirementInput(onPlan).ok).toBe(false);
  });
});

describe("validatePhases", () => {
  it("accepts adjacent, non-overlapping phases", () => {
    expect(validatePhases([
      { fromAge: 55, toAge: 69, monthlyExpenseToday: 60000 },
      { fromAge: 70, toAge: 85, monthlyExpenseToday: 40000 },
    ])).toEqual([]);
  });

  it("rejects a phase that ends before it starts", () => {
    const errors = validatePhases([{ fromAge: 80, toAge: 70, monthlyExpenseToday: 40000 }]);
    expect(errors.join(" ")).toMatch(/must not be after/i);
  });

  // annualExpenseTodayForAge resolves an age with `phases.find(...)`, so an
  // overlap silently resolves to whichever phase is first in the array.
  it("rejects overlapping phases rather than letting array order decide", () => {
    const errors = validatePhases([
      { fromAge: 60, toAge: 75, monthlyExpenseToday: 60000 },
      { fromAge: 70, toAge: 85, monthlyExpenseToday: 40000 },
    ]);
    expect(errors.join(" ")).toMatch(/overlap/i);
  });

  it("treats a single shared year as an overlap", () => {
    const errors = validatePhases([
      { fromAge: 55, toAge: 70, monthlyExpenseToday: 60000 },
      { fromAge: 70, toAge: 85, monthlyExpenseToday: 40000 },
    ]);
    expect(errors.join(" ")).toMatch(/overlap/i);
  });

  it("rejects a negative expense", () => {
    const errors = validatePhases([{ fromAge: 60, toAge: 70, monthlyExpenseToday: -1 }]);
    expect(errors.join(" ")).toMatch(/cannot be negative/i);
  });
});

describe("validateAssetClasses", () => {
  it("accepts the defaults", () => {
    expect(validateAssetClasses(DEFAULT_ASSET_CLASSES)).toEqual([]);
  });

  it("names the offending class so the message is actionable", () => {
    const broken = DEFAULT_ASSET_CLASSES.map((a) =>
      a.key === "gold" ? { ...a, amount: -5 } : a);
    expect(validateAssetClasses(broken).join(" ")).toMatch(/Gold: amount cannot be negative/);
  });

  it("rejects an unparseable rate", () => {
    const broken = DEFAULT_ASSET_CLASSES.map((a) =>
      a.key === "epfo" ? { ...a, ratePct: NaN } : a);
    expect(validateAssetClasses(broken).join(" ")).toMatch(/EPFO: enter a return rate/);
  });
});

describe("field specs", () => {
  it("covers every calculator input field", () => {
    expect(Object.keys(CALCULATOR_FIELD_SPECS).sort()).toEqual(Object.keys(validCalc).sort());
  });

  it("gives every retirement spec a label matching what the form renders", () => {
    for (const spec of Object.values(RETIREMENT_FIELD_SPECS)) {
      expect(spec.label.length).toBeGreaterThan(0);
      expect(spec.min).toBeLessThan(spec.max);
    }
  });
});
