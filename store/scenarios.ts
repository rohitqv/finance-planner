export type Scenario = {
  id: string; name: string;
  lumpsum: number; monthlySip: number; stepUpPct: number;
  annualReturn: number; years: number; inflationPct: number;
  corpusGoal?: number; createdAt: number;
};

import { sanitizeScenarios } from "@/lib/finance/sanitize";

const KEY = "finance-planner:scenarios:v1";
const canUse = () => typeof window !== "undefined" && !!window.localStorage;

export function loadScenarios(): Scenario[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    // Sanitized rather than cast: every row is fed straight into calculate()
    // by ScenarioTable, and a hand-edited or partially-written entry would
    // otherwise surface as NaN figures in the table.
    return raw ? sanitizeScenarios(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveScenarios(list: Scenario[]): void {
  if (!canUse()) return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function addScenario(partial: Omit<Scenario, "id" | "createdAt">): Scenario[] {
  const s: Scenario = { ...partial, id: crypto.randomUUID(), createdAt: Date.now() };
  const list = [...loadScenarios(), s];
  saveScenarios(list);
  return list;
}

export function updateScenario(id: string, patch: Partial<Scenario>): Scenario[] {
  const list = loadScenarios().map((s) => (s.id === id ? { ...s, ...patch } : s));
  saveScenarios(list);
  return list;
}

export function deleteScenario(id: string): Scenario[] {
  const list = loadScenarios().filter((s) => s.id !== id);
  saveScenarios(list);
  return list;
}

export function duplicateScenario(id: string): Scenario[] {
  const src = loadScenarios().find((s) => s.id === id);
  if (!src) return loadScenarios();
  const copy: Scenario = { ...src, id: crypto.randomUUID(), name: src.name + " (copy)", createdAt: Date.now() };
  const list = [...loadScenarios(), copy];
  saveScenarios(list);
  return list;
}
