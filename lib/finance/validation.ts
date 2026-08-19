import type { CalculatorInput } from "./types";
import type { AssetClass, ExpensePhase, RetirementInput } from "./retirement";

// Bounds exist for two different reasons, and it's worth keeping them
// straight: some are *mathematical* preconditions of the engines in this
// folder (a step-up at or below -100% flips the SIP sign and breaks the
// single-sign-change precondition the XIRR solver relies on; an inflation
// or bucket rate at -100% divides by zero or collapses growth entirely),
// and the rest are *plausibility* limits that stop a typo from producing a
// confident-looking nonsense answer. Both are enforced here, at the input
// boundary, so the engines downstream can assume sane numbers.

export type NumericFieldSpec = {
  label: string;
  min: number;
  max: number;
  integer?: boolean;
};

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

export type ValidationResult<K extends string> = {
  ok: boolean;
  /** Per-field messages, keyed by input field, for rendering inline. */
  fields: FieldErrors<K>;
  /** Cross-field and collection messages that belong to no single input. */
  form: string[];
};

// A rupee ceiling high enough that no real plan hits it, low enough that
// compounding it for a century stays far inside float range.
const MAX_MONEY = 1e11;

export const CALCULATOR_FIELD_SPECS: Record<keyof CalculatorInput, NumericFieldSpec> = {
  lumpsum: { label: "Lumpsum", min: 0, max: MAX_MONEY },
  monthlySip: { label: "Monthly SIP", min: 0, max: MAX_MONEY },
  // > -100, not >= -100: at exactly -100% the per-year SIP collapses to 0
  // and below it the sign flips (see lib/finance/returns.ts).
  stepUpPct: { label: "Annual SIP step-up", min: -99, max: 100 },
  annualReturn: { label: "Expected annual return", min: -99, max: 100 },
  years: { label: "Duration (years)", min: 1, max: 100, integer: true },
  inflationPct: { label: "Inflation", min: -50, max: 100 },
};

export type RetirementNumericKey =
  | "currentAge" | "retirementAge" | "lifespanAge" | "currentMonthlyExpense"
  | "inflationPct" | "preReturnPct" | "postReturnPct" | "currentMonthlyInvestment"
  | "sipStepUpPct"
  | "bucketYears" | "safeBucketRatePct" | "growthBucketRatePct";

export const RETIREMENT_FIELD_SPECS: Record<RetirementNumericKey, NumericFieldSpec> = {
  currentAge: { label: "Current age", min: 0, max: 120, integer: true },
  retirementAge: { label: "Retirement age", min: 1, max: 120, integer: true },
  lifespanAge: { label: "Lifespan age", min: 1, max: 150, integer: true },
  currentMonthlyExpense: { label: "Current monthly expense", min: 0, max: MAX_MONEY },
  inflationPct: { label: "Inflation", min: -50, max: 100 },
  preReturnPct: { label: "Return on monthly investment / required SIP", min: -99, max: 100 },
  postReturnPct: { label: "Post-retirement return", min: -99, max: 100 },
  currentMonthlyInvestment: { label: "Current monthly investment", min: 0, max: MAX_MONEY },
  sipStepUpPct: { label: "Annual SIP step-up", min: -99, max: 100 },
  bucketYears: { label: "Years of expense kept safe", min: 1, max: 50, integer: true },
  safeBucketRatePct: { label: "Safe bucket rate", min: -50, max: 100 },
  growthBucketRatePct: { label: "Growth bucket rate", min: -50, max: 100 },
};

function formatBound(n: number): string {
  return Math.abs(n) >= 1e5 ? "₹" + n.toLocaleString("en-IN") : String(n);
}

// A single field, checked against its own spec only. Returns undefined when
// the value is acceptable.
export function validateField(value: number, spec: NumericFieldSpec): string | undefined {
  // Covers NaN (an empty or unparseable input box) and +/-Infinity alike:
  // neither is a number a user can have meant.
  if (!Number.isFinite(value)) return "Enter a number.";
  if (spec.integer && !Number.isInteger(value)) return "Must be a whole number.";
  if (value < spec.min) return `Must be at least ${formatBound(spec.min)}.`;
  if (value > spec.max) return `Must be at most ${formatBound(spec.max)}.`;
  return undefined;
}

// `specs` is Partial so a caller can validate a subset of the fields (see
// the bucket-strategy carve-out below); only the keys actually present are
// checked.
export function validateFields<K extends string>(
  values: Record<K, number>, specs: Partial<Record<K, NumericFieldSpec>>,
): FieldErrors<K> {
  const errors: FieldErrors<K> = {};
  for (const [key, spec] of Object.entries(specs) as [K, NumericFieldSpec][]) {
    const message = validateField(values[key], spec);
    if (message) errors[key] = message;
  }
  return errors;
}

export function validateCalculatorInput(
  input: CalculatorInput,
): ValidationResult<keyof CalculatorInput> {
  const fields = validateFields(input, CALCULATOR_FIELD_SPECS);
  const form: string[] = [];
  if (!fields.lumpsum && !fields.monthlySip && input.lumpsum === 0 && input.monthlySip === 0) {
    form.push("Enter a lumpsum, a monthly SIP, or both — there is nothing to grow otherwise.");
  }
  return { ok: Object.keys(fields).length === 0 && form.length === 0, fields, form };
}

// Phases are validated as a collection: each one internally consistent, and
// no two overlapping. Overlap matters because annualExpenseTodayForAge
// resolves an age with `phases.find(...)`, which silently takes whichever
// overlapping phase happens to come first in the array — a result the user
// has no way to predict from the UI.
export function validatePhases(phases: ExpensePhase[]): string[] {
  const errors: string[] = [];
  phases.forEach((p, idx) => {
    const n = idx + 1;
    if (!Number.isFinite(p.fromAge) || !Number.isFinite(p.toAge) || !Number.isFinite(p.monthlyExpenseToday)) {
      errors.push(`Phase ${n}: every field needs a number.`);
      return;
    }
    if (p.fromAge > p.toAge) errors.push(`Phase ${n}: "from age" must not be after "to age".`);
    if (p.monthlyExpenseToday < 0) errors.push(`Phase ${n}: monthly expense cannot be negative.`);
  });
  for (let i = 0; i < phases.length; i++) {
    for (let j = i + 1; j < phases.length; j++) {
      const a = phases[i];
      const b = phases[j];
      if (a.fromAge <= b.toAge && b.fromAge <= a.toAge) {
        errors.push(`Phases ${i + 1} and ${j + 1} overlap — an age in both would silently use the first.`);
      }
    }
  }
  return errors;
}

export function validateAssetClasses(assetClasses: AssetClass[]): string[] {
  const errors: string[] = [];
  for (const a of assetClasses) {
    if (!Number.isFinite(a.amount)) errors.push(`${a.label}: enter an amount.`);
    else if (a.amount < 0) errors.push(`${a.label}: amount cannot be negative.`);
    else if (a.amount > MAX_MONEY) errors.push(`${a.label}: amount is implausibly large.`);
    if (!Number.isFinite(a.ratePct)) errors.push(`${a.label}: enter a return rate.`);
    else if (a.ratePct < -99 || a.ratePct > 100) errors.push(`${a.label}: return must be between -99% and 100%.`);
  }
  return errors;
}

const BUCKET_KEYS = ["bucketYears", "safeBucketRatePct", "growthBucketRatePct"] as const;

export function validateRetirementInput(
  input: RetirementInput,
): ValidationResult<RetirementNumericKey> {
  // Bucket fields are hidden while the strategy is off, and they are ignored
  // by the math in that mode too — so validating them would block results on
  // an input the user cannot even see to fix.
  const specs = { ...RETIREMENT_FIELD_SPECS };
  if (!input.useBucketStrategy) for (const k of BUCKET_KEYS) delete specs[k];
  const fields = validateFields<RetirementNumericKey>(input, specs);
  const form: string[] = [];

  // Cross-field age ordering. Only checked once each age is individually
  // valid, so a half-typed age reports "Enter a number" rather than an
  // ordering complaint the user can't act on yet.
  if (!fields.currentAge && !fields.retirementAge && input.retirementAge <= input.currentAge) {
    form.push("Retirement age must be greater than current age.");
  }
  if (!fields.retirementAge && !fields.lifespanAge && input.lifespanAge <= input.retirementAge) {
    form.push("Lifespan must be greater than retirement age.");
  }

  form.push(...validatePhases(input.phases));
  form.push(...validateAssetClasses(input.assetClasses));

  return { ok: Object.keys(fields).length === 0 && form.length === 0, fields, form };
}

// Flattens a result into human-readable lines for an error summary panel:
// field messages get their field's label prepended (a bare "Enter a number."
// is useless in a list), cross-field messages already read as sentences.
export function summarizeValidation<K extends string>(
  result: ValidationResult<K>, specs: Partial<Record<K, NumericFieldSpec>>,
): string[] {
  const fieldMessages = (Object.entries(result.fields) as [K, string][])
    .map(([key, message]) => `${specs[key]?.label ?? key}: ${message}`);
  return [...fieldMessages, ...result.form];
}
