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
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Re-syncs plan/scenarios from localStorage. This component is mounted
  // once in app/page.tsx and never remounts on tab switches, so data saved
  // elsewhere (e.g. a scenario saved on the Calculator tab, or a plan edit
  // on the Retirement tab) wouldn't otherwise be reflected here without a
  // full page reload. Called on mount and again whenever the user's mouse
  // or keyboard focus approaches the export/import controls — a natural
  // moment right before they'd use them — rather than polling or adding a
  // change-notification layer to the stores.
  //
  // Only auto-(un)checks a checkbox when the underlying data's existence
  // actually *changes* (none -> some, or some -> none) — never on a refresh
  // where the existence state is unchanged, so a user's own manual
  // check/uncheck choice for an export that's already in progress is never
  // silently overwritten.
  const refresh = () => {
    const loadedPlan = loadPlan();
    const loadedScenarios = loadScenarios();
    if ((plan === null) !== (loadedPlan === null)) {
      setIncludePlan(loadedPlan !== null);
    }
    if ((scenarios.length === 0) !== (loadedScenarios.length === 0)) {
      setIncludeScenarios(loadedScenarios.length > 0);
    }
    setPlan(loadedPlan);
    setScenarios(loadedScenarios);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration read of localStorage, see comment above
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: refresh() is intentionally re-created each render (it closes over current plan/scenarios) and is also called imperatively from the handlers below; including it here would defeat the mount-only intent.
  }, []);

  // Close the dropdown on outside clicks and Escape while it's open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

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
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const handleImportFile = async (file: File) => {
    setError(null);
    let payload;
    try {
      const text = await file.text();
      payload = parseBackupPayload(text);
    } catch (err) {
      const cause = err instanceof Error ? err.message : undefined;
      setError(
        cause
          ? `This file doesn't look like a Finance Planner backup. ${cause}`
          : "This file doesn't look like a Finance Planner backup.",
      );
      return;
    }

    let changed = false;

    if (payload.scenarios && payload.scenarios.length > 0) {
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
    <div
      ref={rootRef}
      className="relative text-sm"
      onMouseEnter={refresh}
      onFocus={refresh}
      onPointerDown={refresh}
    >
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-700"
        onClick={() => {
          refresh();
          setOpen((v) => !v);
        }}
      >
        <svg
          aria-hidden="true"
          className="h-4 w-4 text-gray-500 dark:text-gray-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm1 4a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm-1 3.5a1 1 0 0 1 1 1V13a1 1 0 1 1-2 0v-1.5a1 1 0 0 1 1-1Z" />
        </svg>
        Backup &amp; Data
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Export / import
          </p>
          <div className="flex flex-col gap-2 text-gray-900 dark:text-gray-100">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Include retirement plan in export"
                checked={includePlan}
                disabled={plan === null}
                onChange={(e) => setIncludePlan(e.target.checked)}
              />
              Retirement plan
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label="Include saved scenarios in export"
                checked={includeScenarios}
                disabled={scenarios.length === 0}
                onChange={(e) => setIncludeScenarios(e.target.checked)}
              />
              Saved scenarios ({scenarios.length})
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canExport}
              onClick={handleExport}
            >
              Export data
            </button>
            <button
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              onClick={() => fileInputRef.current?.click()}
            >
              Import data
            </button>
          </div>
          {error ? <span className="mt-2 block text-xs text-red-600 dark:text-red-400">{error}</span> : null}
        </div>
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Import backup file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleImportFile(file);
        }}
      />
    </div>
  );
}
