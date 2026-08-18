import { DEFAULT_ASSET_CLASSES, type AssetClass, type RetirementInput } from "@/lib/finance/retirement";

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

// Reconciles a saved assetClasses value against the current fixed set: keeps
// each saved entry for a key that's still known, and fills in any class that
// didn't exist yet when the plan was saved (e.g. Fixed Deposit added after
// the user's plan) with its default. This lets the fixed set grow over time
// without discarding a user's already-saved amounts in the other classes.
function reconcileAssetClasses(saved: unknown): AssetClass[] {
  const savedArray = Array.isArray(saved) ? saved : [];
  const byKey = new Map(
    savedArray
      .filter((a): a is AssetClass => !!a && typeof a === "object" && "key" in a)
      .map((a) => [a.key, a]),
  );
  return DEFAULT_ASSET_CLASSES.map((def) => byKey.get(def.key) ?? def);
}

export function loadPlan(): RetirementInput | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyPlan | RetirementInput;
    const migrated = !("assetClasses" in parsed) || parsed.assetClasses == null
      ? migrateLegacyPlan(parsed as LegacyPlan)
      : { ...parsed, assetClasses: reconcileAssetClasses(parsed.assetClasses) } as RetirementInput;
    // Plans saved before the bucket-strategy feature shipped won't have
    // these fields at all — fill them with the documented defaults rather
    // than leaving them undefined.
    return {
      useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
      ...migrated,
    };
  } catch {
    return null;
  }
}

export function savePlan(plan: RetirementInput): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(plan));
}
