"use client";
import { useEffect, useRef, useState } from "react";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import { loadScenarios, saveScenarios } from "@/store/scenarios";
import { buildBackupPayload, mergeImportedScenarios, parseBackupPayload } from "@/lib/backup/backup";
import type { RetirementInput } from "@/lib/finance/retirement";
import type { Scenario } from "@/store/scenarios";

export default function BackupRestore() {
  // SSR-safe defaults, then load the real values post-mount — mirrors the
  // pattern in components/calculator/CalculatorTab.tsx for `scenarios`:
  // localStorage isn't available during SSR, so the first render must match
  // what a server render would produce, or hydration mismatches.
  const [plan, setPlan] = useState<RetirementInput | null>(null);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [includePlan, setIncludePlan] = useState(false);
  const [includeScenarios, setIncludeScenarios] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadedPlan = loadPlan();
    const loadedScenarios = loadScenarios();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration read of localStorage, see comment above
    setPlan(loadedPlan);
    setScenarios(loadedScenarios);
    setIncludePlan(loadedPlan !== null);
    setIncludeScenarios(loadedScenarios.length > 0);
  }, []);

  const canExport = (includePlan && plan !== null) || (includeScenarios && scenarios.length > 0);

  const handleExport = () => {
    const currentPlan = loadPlan();
    const currentScenarios = loadScenarios();
    const payload = buildBackupPayload({
      retirementPlan: includePlan && currentPlan ? currentPlan : undefined,
      scenarios: includeScenarios && currentScenarios.length > 0 ? currentScenarios : undefined,
    });
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-planner-backup-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    let payload;
    try {
      const text = await file.text();
      payload = parseBackupPayload(text);
    } catch {
      setError("This file doesn't look like a Finance Planner backup.");
      return;
    }

    let changed = false;

    if (payload.scenarios) {
      saveScenarios(mergeImportedScenarios(loadScenarios(), payload.scenarios));
      changed = true;
    }

    if (payload.retirementPlan) {
      const existingPlan = loadPlan();
      const shouldWrite =
        existingPlan === null ||
        window.confirm("This will replace your current retirement plan inputs. Continue?");
      if (shouldWrite) {
        savePlan(payload.retirementPlan);
        changed = true;
      }
    }

    if (changed) {
      window.location.reload();
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          aria-label="Include retirement plan in export"
          checked={includePlan}
          disabled={plan === null}
          onChange={(e) => setIncludePlan(e.target.checked)}
        />
        Retirement plan
      </label>
      <label className="flex items-center gap-1">
        <input
          type="checkbox"
          aria-label="Include saved scenarios in export"
          checked={includeScenarios}
          disabled={scenarios.length === 0}
          onChange={(e) => setIncludeScenarios(e.target.checked)}
        />
        Saved scenarios ({scenarios.length})
      </label>
      <button
        className="rounded border px-3 py-1 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!canExport}
        onClick={handleExport}
      >
        Export data
      </button>
      <button className="rounded border px-3 py-1" onClick={() => fileInputRef.current?.click()}>
        Import data
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        aria-label="Import backup file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleImportFile(file);
        }}
      />
      {error && <span className="text-red-600">{error}</span>}
    </div>
  );
}
