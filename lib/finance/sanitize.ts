import { DEFAULT_ASSET_CLASSES, type AssetClass, type ExpensePhase, type RetirementInput } from "./retirement";
import { DEFAULT_CALCULATOR_INPUT, DEFAULT_RETIREMENT_INPUT } from "./defaults";
import { CALCULATOR_FIELD_SPECS, RETIREMENT_FIELD_SPECS, type RetirementNumericKey } from "./validation";
import type { CalculatorInput } from "./types";
import type { Scenario } from "@/store/scenarios";

// Everything read back from localStorage or an imported backup file is
// untrusted: it may predate a field, have been hand-edited, or have been
// written by a JSON round-trip that turned a NaN into `null`. These
// functions guarantee the app only ever sees a structurally complete object
// of finite numbers, replacing anything else with the documented default —
// so the type assertions the stores used to make are actually true.

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function boolOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function sanitizePhases(raw: unknown): ExpensePhase[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isPlainObject).map((p) => ({
    fromAge: finiteOr(p.fromAge, 0),
    toAge: finiteOr(p.toAge, 0),
    monthlyExpenseToday: finiteOr(p.monthlyExpenseToday, 0),
  }));
}

// Reconciles saved asset classes against the current fixed set: keeps each
// saved entry whose key is still known (with its numbers checked), and fills
// in any class that didn't exist when the plan was saved with its default.
// The fixed set can therefore grow without discarding a user's amounts.
export function sanitizeAssetClasses(raw: unknown): AssetClass[] {
  const savedArray = Array.isArray(raw) ? raw : [];
  const byKey = new Map(
    savedArray
      .filter(isPlainObject)
      .filter((a) => typeof a.key === "string")
      .map((a) => [a.key as string, a]),
  );
  return DEFAULT_ASSET_CLASSES.map((def) => {
    const saved = byKey.get(def.key);
    if (!saved) return def;
    return {
      ...def,
      amount: finiteOr(saved.amount, def.amount),
      ratePct: finiteOr(saved.ratePct, def.ratePct),
      includeInRetirement: boolOr(saved.includeInRetirement, def.includeInRetirement),
    };
  });
}

export function sanitizeRetirementInput(raw: unknown): RetirementInput {
  const src = isPlainObject(raw) ? raw : {};
  const out = { ...DEFAULT_RETIREMENT_INPUT };
  for (const key of Object.keys(RETIREMENT_FIELD_SPECS) as RetirementNumericKey[]) {
    out[key] = finiteOr(src[key], DEFAULT_RETIREMENT_INPUT[key]);
  }
  out.useBucketStrategy = boolOr(src.useBucketStrategy, DEFAULT_RETIREMENT_INPUT.useBucketStrategy);
  out.phases = sanitizePhases(src.phases);
  out.assetClasses = sanitizeAssetClasses(src.assetClasses);
  return out;
}

export function sanitizeCalculatorInput(raw: unknown): CalculatorInput {
  const src = isPlainObject(raw) ? raw : {};
  const out = { ...DEFAULT_CALCULATOR_INPUT };
  for (const key of Object.keys(CALCULATOR_FIELD_SPECS) as (keyof CalculatorInput)[]) {
    out[key] = finiteOr(src[key], DEFAULT_CALCULATOR_INPUT[key]);
  }
  return out;
}

// A scenario without an id or name can't be listed or deleted, so it's
// dropped outright rather than repaired into an anonymous row.
export function sanitizeScenario(raw: unknown): Scenario | null {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== "string" || raw.id === "") return null;
  if (typeof raw.name !== "string" || raw.name === "") return null;
  const numbers = sanitizeCalculatorInput(raw);
  const corpusGoal =
    typeof raw.corpusGoal === "number" && Number.isFinite(raw.corpusGoal)
      ? raw.corpusGoal
      : undefined;
  return {
    ...numbers,
    id: raw.id,
    name: raw.name,
    createdAt: finiteOr(raw.createdAt, 0),
    ...(corpusGoal === undefined ? {} : { corpusGoal }),
  };
}

export function sanitizeScenarios(raw: unknown): Scenario[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeScenario).filter((s): s is Scenario => s !== null);
}
