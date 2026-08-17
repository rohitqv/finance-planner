import type { RetirementInput } from "@/lib/finance/retirement";
import type { Scenario } from "@/store/scenarios";

export type BackupPayload = {
  version: 1;
  exportedAt: string;
  retirementPlan?: RetirementInput;
  scenarios?: Scenario[];
};

export function buildBackupPayload({
  retirementPlan, scenarios,
}: { retirementPlan?: RetirementInput; scenarios?: Scenario[] }): BackupPayload {
  const payload: BackupPayload = { version: 1, exportedAt: new Date().toISOString() };
  if (retirementPlan) payload.retirementPlan = retirementPlan;
  if (scenarios) payload.scenarios = scenarios;
  return payload;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseBackupPayload(raw: string): BackupPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("File is not valid JSON.");
  }
  if (!isPlainObject(parsed)) {
    throw new Error("File does not contain a backup object.");
  }
  if (parsed.version !== 1) {
    throw new Error("Unrecognized backup version.");
  }
  if (parsed.retirementPlan !== undefined) {
    const plan = parsed.retirementPlan;
    if (!isPlainObject(plan) || !Array.isArray(plan.assetClasses)) {
      throw new Error("Backup's retirement plan is malformed.");
    }
  }
  if (parsed.scenarios !== undefined) {
    const scenarios = parsed.scenarios;
    if (!Array.isArray(scenarios) || scenarios.some((s) => !isPlainObject(s) || typeof s.name !== "string")) {
      throw new Error("Backup's saved scenarios are malformed.");
    }
  }
  return parsed as BackupPayload;
}

export function mergeImportedScenarios(existing: Scenario[], imported: Scenario[]): Scenario[] {
  return [...existing, ...imported.map((s) => ({ ...s, id: crypto.randomUUID() }))];
}
