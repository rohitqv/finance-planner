import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const KEY = "finance-planner:retirement:v1";
const canUse = () => typeof window !== "undefined" && !!window.localStorage;

// Shape of a plan saved before the asset-class split shipped: a single
// currentCorpus number instead of an assetClasses array.
type LegacyPlan = Omit<RetirementInput, "assetClasses"> & { currentCorpus?: number };

function migrateLegacyPlan(legacy: LegacyPlan): RetirementInput {
  const { currentCorpus, ...rest } = legacy;
  const assetClasses = DEFAULT_ASSET_CLASSES.map((a) =>
    a.key === "mutualFund"
      ? { ...a, amount: currentCorpus ?? 0, ratePct: legacy.preReturnPct }
      : a,
  );
  return { ...rest, assetClasses };
}

export function loadPlan(): RetirementInput | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyPlan | RetirementInput;
    const hasValidAssetClasses =
      "assetClasses" in parsed &&
      Array.isArray(parsed.assetClasses) &&
      parsed.assetClasses.length === 4;
    if (!hasValidAssetClasses) {
      return migrateLegacyPlan(parsed as LegacyPlan);
    }
    return parsed as RetirementInput;
  } catch {
    return null;
  }
}

export function savePlan(plan: RetirementInput): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(plan));
}
