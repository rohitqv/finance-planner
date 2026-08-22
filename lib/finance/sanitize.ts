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

// One saved row merged onto a base. `base` is the built-in default for a
// known key, or a neutral placeholder for a key this build has never heard of
// — an unknown asset with an unreadable rate is worth 0% rather than being
// credited with invented growth.
function shapeAssetClass(
  key: string, base: Omit<AssetClass, "key">, saved: Record<string, unknown> | undefined,
): AssetClass {
  if (!saved) return { key, ...base };
  const savedLabel = typeof saved.label === "string" ? saved.label.trim() : "";
  return {
    key,
    label: savedLabel === "" ? base.label : savedLabel,
    amount: finiteOr(saved.amount, base.amount),
    ratePct: finiteOr(saved.ratePct, base.ratePct),
    includeInRetirement: boolOr(saved.includeInRetirement, base.includeInRetirement),
  };
}

// Reconciles saved asset classes against the built-in set. Every default is
// emitted in its declared order, carrying the user's saved values where there
// are any; then any saved key with no built-in counterpart is appended in the
// order it was saved.
//
// That second pass is the point of the function. It used to map over
// DEFAULT_ASSET_CLASSES and look saved values up, a shape that structurally
// could not emit a key outside the built-in five — so an asset written by a
// newer build, or restored from a backup that predated this one, lost its
// balance on load with no error and no way to recover it.
export function sanitizeAssetClasses(raw: unknown): AssetClass[] {
  const rows = (Array.isArray(raw) ? raw : [])
    .filter(isPlainObject)
    .filter((a) => typeof a.key === "string" && a.key.trim() !== "");

  // First occurrence wins. `new Map(entries)` keeps the *last*, which would
  // silently prefer a stale duplicate over the row a user most likely edited.
  // Duplicates matter now that keys are open: AssetClassTable uses `key` as
  // both its React key and its edit identity, so two rows sharing one would
  // be patched together by a single keystroke, and includedCorpusAmount would
  // count the balance twice.
  const byKey = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = row.key as string;
    if (!byKey.has(key)) byKey.set(key, row);
  }

  const builtIn = DEFAULT_ASSET_CLASSES.map(({ key, ...base }) =>
    shapeAssetClass(key, base, byKey.get(key)));

  const builtInKeys = new Set(DEFAULT_ASSET_CLASSES.map((a) => a.key));
  const extras: AssetClass[] = [];
  for (const [key, row] of byKey) {
    if (builtInKeys.has(key)) continue;
    // Map iteration is insertion order, so extras keep their saved order.
    extras.push(shapeAssetClass(
      key, { label: key, amount: 0, ratePct: 0, includeInRetirement: true }, row,
    ));
  }

  return [...builtIn, ...extras];
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
