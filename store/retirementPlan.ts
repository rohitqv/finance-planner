import type { RetirementInput } from "@/lib/finance/retirement";

const KEY = "finance-planner:retirement:v1";
const canUse = () => typeof window !== "undefined" && !!window.localStorage;

export function loadPlan(): RetirementInput | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RetirementInput) : null;
  } catch {
    return null;
  }
}

export function savePlan(plan: RetirementInput): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(plan));
}
