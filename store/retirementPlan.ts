import type { RetirementInput } from "@/lib/finance/retirement";
import { DEFAULT_RETIREMENT_INPUT } from "@/lib/finance/defaults";
import { sanitizeRetirementInput } from "@/lib/finance/sanitize";

const KEY = "finance-planner:retirement:v1";
const canUse = () => typeof window !== "undefined" && !!window.localStorage;

// Shape of a plan saved before the asset-class split shipped: a single
// currentCorpus number instead of an assetClasses array.
type LegacyPlan = Record<string, unknown> & { currentCorpus?: number; preReturnPct?: number };

// Version-to-version migration lives here; field-level repair lives in
// sanitizeRetirementInput. The split matters: this function only needs to
// know how the *shape* changed, and every plan — migrated or not — goes
// through the sanitizer afterwards, so neither has to guess at defaults the
// other might also be filling in.
function migrateLegacyPlan(legacy: LegacyPlan): Record<string, unknown> {
  const { currentCorpus, ...rest } = legacy;
  const assetClasses = DEFAULT_RETIREMENT_INPUT.assetClasses.map((a) =>
    a.key === "mutualFund"
      ? {
          ...a,
          amount: currentCorpus ?? 0,
          ratePct: typeof legacy.preReturnPct === "number" ? legacy.preReturnPct : a.ratePct,
        }
      : a,
  );
  return { ...rest, assetClasses };
}

export function loadPlan(): RetirementInput | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyPlan;
    const shaped =
      parsed && typeof parsed === "object" && !("assetClasses" in parsed)
        ? migrateLegacyPlan(parsed)
        : parsed;
    return sanitizeRetirementInput(shaped);
  } catch {
    return null;
  }
}

export function savePlan(plan: RetirementInput): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(plan));
}
