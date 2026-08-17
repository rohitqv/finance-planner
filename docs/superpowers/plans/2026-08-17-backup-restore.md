# Backup / Restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user export their retirement plan and/or saved Calculator scenarios to a downloaded JSON file, and import that file later to restore the data (e.g. after clearing browser storage).

**Architecture:** A pure, browser-API-free module (`lib/backup/backup.ts`) owns the file format and validation logic. A new client component (`components/BackupRestore.tsx`) owns the browser-specific glue (file download, file picker, `window.confirm`, `window.location.reload`) and is mounted once in `app/page.tsx`, above the tab bar, so it's visible regardless of which tab is active.

**Tech Stack:** Next.js, React, TypeScript, Vitest, @testing-library/react. Storage stays `localStorage` via the existing `store/retirementPlan.ts` and `store/scenarios.ts` modules — no backend involved.

## Global Constraints

- JSON only — no CSV export or import.
- Export includes a `retirementPlan`/`scenarios` key only when that data was selected (checked) at export time; never an empty/null placeholder for the unselected part.
- `parseBackupPayload` throws a descriptive `Error` on any invalid input (bad JSON, wrong/missing `version`, malformed `retirementPlan` or `scenarios`) — never returns `null`/`undefined` on failure.
- `mergeImportedScenarios` always assigns a **fresh** `crypto.randomUUID()` to every imported scenario — it never trusts or reuses IDs from the imported file, so a merge can never collide with an existing scenario's ID.
- Importing a `retirementPlan` is a full replace. If a plan is already saved, show `window.confirm("This will replace your current retirement plan inputs. Continue?")` first and only write if confirmed. If no plan is saved yet, write directly with no confirmation. Importing `scenarios` never asks for confirmation (always additive/merged).
- On any successful write during import, call `window.location.reload()` so both tabs re-read fresh state from `localStorage`.
- Export filename format: `finance-planner-backup-YYYY-MM-DD.json` (from `new Date().toISOString().slice(0, 10)`).
- `BackupRestore` must not read `localStorage` during its first render (no hydration mismatch) — mirror the lazy-default-then-`useEffect` pattern already used in `components/calculator/CalculatorTab.tsx` for its `scenarios` state.

---

### Task 1: Core backup/restore logic (`lib/backup/backup.ts`)

**Files:**
- Create: `lib/backup/backup.ts`
- Test: `lib/backup/__tests__/backup.test.ts`

**Interfaces:**
- Consumes: `RetirementInput` from `@/lib/finance/retirement`; `Scenario` from `@/store/scenarios`.
- Produces: `BackupPayload` type (`{ version: 1; exportedAt: string; retirementPlan?: RetirementInput; scenarios?: Scenario[] }`), `buildBackupPayload({ retirementPlan?, scenarios? }): BackupPayload`, `parseBackupPayload(raw: string): BackupPayload` (throws `Error` on invalid input), `mergeImportedScenarios(existing: Scenario[], imported: Scenario[]): Scenario[]`.

- [ ] **Step 1: Write the failing tests**

Create `lib/backup/__tests__/backup.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildBackupPayload, parseBackupPayload, mergeImportedScenarios } from "@/lib/backup/backup";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";
import type { Scenario } from "@/store/scenarios";

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};

const scenario: Scenario = {
  id: "s1", name: "Base case", lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6, createdAt: 1000,
};

describe("buildBackupPayload", () => {
  it("includes only the parts provided", () => {
    const planOnly = buildBackupPayload({ retirementPlan: plan });
    expect(planOnly.retirementPlan).toEqual(plan);
    expect(planOnly.scenarios).toBeUndefined();

    const scenariosOnly = buildBackupPayload({ scenarios: [scenario] });
    expect(scenariosOnly.scenarios).toEqual([scenario]);
    expect(scenariosOnly.retirementPlan).toBeUndefined();

    const both = buildBackupPayload({ retirementPlan: plan, scenarios: [scenario] });
    expect(both.retirementPlan).toEqual(plan);
    expect(both.scenarios).toEqual([scenario]);
  });

  it("always sets version 1 and an ISO exportedAt timestamp", () => {
    const payload = buildBackupPayload({});
    expect(payload.version).toBe(1);
    expect(new Date(payload.exportedAt).toISOString()).toBe(payload.exportedAt);
  });
});

describe("parseBackupPayload", () => {
  it("round-trips a payload built by buildBackupPayload", () => {
    const built = buildBackupPayload({ retirementPlan: plan, scenarios: [scenario] });
    const parsed = parseBackupPayload(JSON.stringify(built));
    expect(parsed).toEqual(built);
  });

  it("accepts a plan-only payload", () => {
    const built = buildBackupPayload({ retirementPlan: plan });
    expect(() => parseBackupPayload(JSON.stringify(built))).not.toThrow();
  });

  it("accepts a scenarios-only payload", () => {
    const built = buildBackupPayload({ scenarios: [scenario] });
    expect(() => parseBackupPayload(JSON.stringify(built))).not.toThrow();
  });

  it("throws on invalid JSON", () => {
    expect(() => parseBackupPayload("{not json")).toThrow();
  });

  it("throws when version is missing or wrong", () => {
    expect(() => parseBackupPayload(JSON.stringify({ exportedAt: "x" }))).toThrow();
    expect(() => parseBackupPayload(JSON.stringify({ version: 2, exportedAt: "x" }))).toThrow();
  });

  it("throws when retirementPlan is present but malformed (no assetClasses array)", () => {
    const bad = { version: 1, exportedAt: "x", retirementPlan: { currentAge: 30 } };
    expect(() => parseBackupPayload(JSON.stringify(bad))).toThrow();
  });

  it("throws when scenarios is present but malformed (entry missing name)", () => {
    const bad = { version: 1, exportedAt: "x", scenarios: [{ lumpsum: 0 }] };
    expect(() => parseBackupPayload(JSON.stringify(bad))).toThrow();
  });
});

describe("mergeImportedScenarios", () => {
  it("appends imported scenarios to the existing list", () => {
    const merged = mergeImportedScenarios([scenario], [{ ...scenario, id: "s2", name: "Imported" }]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toEqual(scenario);
    expect(merged[1].name).toBe("Imported");
  });

  it("always assigns a fresh id to every imported scenario, never trusting the file's id", () => {
    const merged = mergeImportedScenarios([], [{ ...scenario, id: "s1" }]);
    expect(merged[0].id).not.toBe("s1");
    expect(merged[0].id).toBeTruthy();
  });

  it("never collides with an existing scenario's id even if the imported file reuses it", () => {
    const merged = mergeImportedScenarios([scenario], [{ ...scenario, id: scenario.id, name: "Duplicate id in file" }]);
    const ids = merged.map((s) => s.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("handles an empty existing list", () => {
    const merged = mergeImportedScenarios([], [scenario]);
    expect(merged).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/backup/__tests__/backup.test.ts`
Expected: FAIL — `Cannot find module '@/lib/backup/backup'`

- [ ] **Step 3: Implement `lib/backup/backup.ts`**

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/backup/__tests__/backup.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `lib/backup/backup.ts` or its test file.

- [ ] **Step 6: Commit**

```bash
git add lib/backup/backup.ts lib/backup/__tests__/backup.test.ts
git commit -m "feat: add backup/restore payload build, parse, and merge logic"
```

---

### Task 2: `BackupRestore` UI component

**Files:**
- Create: `components/BackupRestore.tsx`
- Test: `components/__tests__/BackupRestore.test.tsx`

**Interfaces:**
- Consumes: `buildBackupPayload`, `parseBackupPayload`, `mergeImportedScenarios` from `@/lib/backup/backup` (Task 1); `loadPlan`, `savePlan` from `@/store/retirementPlan`; `loadScenarios`, `saveScenarios` from `@/store/scenarios`.
- Produces: `BackupRestore` default export, a component taking no props.

- [ ] **Step 1: Write the failing tests**

Create `components/__tests__/BackupRestore.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import BackupRestore from "@/components/BackupRestore";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import { loadScenarios, saveScenarios } from "@/store/scenarios";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";
import type { Scenario } from "@/store/scenarios";

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};

const scenario: Scenario = {
  id: "s1", name: "Base case", lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6, createdAt: 1000,
};

let reloadMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  reloadMock = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function backupFile(payload: unknown, name = "backup.json"): File {
  return new File([JSON.stringify(payload)], name, { type: "application/json" });
}

describe("BackupRestore", () => {
  it("disables Export when nothing is saved", () => {
    render(<BackupRestore />);
    expect(screen.getByRole("button", { name: /export data/i })).toBeDisabled();
  });

  it("enables Export and checks both boxes by default once a plan and scenarios exist", () => {
    savePlan(plan);
    saveScenarios([scenario]);
    render(<BackupRestore />);
    expect(screen.getByRole("button", { name: /export data/i })).toBeEnabled();
    expect(screen.getByLabelText(/include retirement plan/i)).toBeChecked();
    expect(screen.getByLabelText(/include saved scenarios/i)).toBeChecked();
  });

  it("exports a JSON blob containing the checked data", async () => {
    savePlan(plan);
    saveScenarios([scenario]);
    render(<BackupRestore />);

    const createObjectURL = global.URL.createObjectURL as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const parsed = JSON.parse(await blob.text());
    expect(parsed.version).toBe(1);
    expect(parsed.retirementPlan).toEqual(plan);
    expect(parsed.scenarios).toEqual([scenario]);
  });

  it("shows an error and saves nothing when the imported file is invalid", async () => {
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [backupFile({ not: "a backup" })] } });

    await waitFor(() => {
      expect(screen.getByText(/doesn't look like a finance planner backup/i)).toBeInTheDocument();
    });
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("imports scenarios without confirmation and merges with fresh ids", async () => {
    saveScenarios([scenario]);
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    const confirmSpy = vi.spyOn(window, "confirm");

    fireEvent.change(input, {
      target: {
        files: [backupFile({
          version: 1, exportedAt: "2026-01-01T00:00:00.000Z",
          scenarios: [{ ...scenario, id: "imported-1", name: "Imported" }],
        })],
      },
    });

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();

    const stored = loadScenarios();
    expect(stored).toHaveLength(2);
    expect(stored.some((s) => s.name === "Imported" && s.id !== "imported-1")).toBe(true);
  });

  it("imports a plan directly (no confirm) when no plan is currently saved", async () => {
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    const confirmSpy = vi.spyOn(window, "confirm");

    fireEvent.change(input, {
      target: { files: [backupFile({ version: 1, exportedAt: "2026-01-01T00:00:00.000Z", retirementPlan: plan })] },
    });

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(loadPlan()).toEqual(plan);
  });

  it("asks for confirmation before overwriting an existing plan, and skips the write when cancelled", async () => {
    savePlan({ ...plan, currentAge: 40 });
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    fireEvent.change(input, {
      target: { files: [backupFile({ version: 1, exportedAt: "2026-01-01T00:00:00.000Z", retirementPlan: plan })] },
    });

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(reloadMock).not.toHaveBeenCalled();
    expect(loadPlan()?.currentAge).toBe(40); // unchanged
  });

  it("overwrites the plan when confirmed", async () => {
    savePlan({ ...plan, currentAge: 40 });
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.change(input, {
      target: { files: [backupFile({ version: 1, exportedAt: "2026-01-01T00:00:00.000Z", retirementPlan: plan })] },
    });

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(loadPlan()?.currentAge).toBe(30);
  });

  describe("SSR hydration safety", () => {
    // Mirrors the equivalent test in components/calculator/__tests__/CalculatorTab.test.tsx.
    // React Testing Library's `render()` wraps mounting in `act()`, which
    // flushes passive effects synchronously — so it can't observe the
    // pre-effect commit. Using raw `react-dom/client` with `flushSync`
    // (which commits the initial render but does NOT flush passive effects)
    // mirrors what a real browser does: paint first, run the post-hydration
    // `useEffect` after. If that first render ever read localStorage
    // directly, it would show checked/enabled controls here that a real
    // server render (no `window`/`localStorage`) could never have produced —
    // a hydration mismatch.
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    it("renders Export disabled on the very first (pre-effect) commit even when a plan and scenarios are already saved", async () => {
      savePlan(plan);
      saveScenarios([scenario]);

      root = createRoot(container);
      flushSync(() => root.render(<BackupRestore />));

      // First paint must match what a server render would have produced:
      // nothing saved, because SSR never sees localStorage.
      const exportButton = container.querySelector("button");
      expect(exportButton?.textContent).toMatch(/export data/i);
      expect(exportButton).toBeDisabled();

      // After effects flush (post-hydration), the real saved data shows up.
      await act(async () => {});
      expect(exportButton).toBeEnabled();
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/__tests__/BackupRestore.test.tsx`
Expected: FAIL — `Cannot find module '@/components/BackupRestore'`

- [ ] **Step 3: Implement `components/BackupRestore.tsx`**

```tsx
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/__tests__/BackupRestore.test.tsx`
Expected: PASS (all 9 tests)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors from `components/BackupRestore.tsx` or its test file.

- [ ] **Step 6: Commit**

```bash
git add components/BackupRestore.tsx components/__tests__/BackupRestore.test.tsx
git commit -m "feat: add BackupRestore export/import UI component"
```

---

### Task 3: Wire `BackupRestore` into the app shell

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `BackupRestore` default export from `@/components/BackupRestore` (Task 2).

- [ ] **Step 1: Add the import and render it above the tab bar**

In `app/page.tsx`, add the import alongside the existing ones:

```tsx
import BackupRestore from "@/components/BackupRestore";
```

Then render it between the `<h1>` and `<Tabs>` lines:

```tsx
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Finance Planner</h1>
      <BackupRestore />
      <Tabs tabs={["Investment Calculator", "Retirement Planner"]} active={active} onSelect={setActive} />
```

- [ ] **Step 2: Run the full test suite to confirm no regressions**

Run: `npx vitest run`
Expected: PASS, all files — including `components/__tests__/App.test.tsx`, which renders `<Page />` and was not modified by this task; `BackupRestore` rendering alongside it must not break any existing `getByRole`/`getByLabelText` lookup used there (its own controls use distinct labels: "Export data", "Import data", "Include retirement plan in export", "Include saved scenarios in export", "Import backup file" — none overlap with existing Retirement/Calculator tab labels).

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: mount BackupRestore in the app shell"
```

---

### Task 4: Manual verification in the browser

**Files:** none (manual QA pass)

- [ ] **Step 1: Start the dev server and open the app**

Run: `npm run dev` (or use the project's preview tooling).

- [ ] **Step 2: Set up some data to export**

On the Retirement tab, enter a few non-default values (e.g. set Mutual Fund amount to 500000). On the Calculator tab, save a scenario. Confirm the "Retirement plan" and "Saved scenarios (1)" checkboxes above the tab bar are both checked and the "Export data" button is enabled.

- [ ] **Step 3: Export and inspect the file**

Click "Export data". Confirm a file named `finance-planner-backup-YYYY-MM-DD.json` downloads, and that opening it shows `version: 1`, an `exportedAt` timestamp, your `retirementPlan` (with the Mutual Fund amount you set), and your `scenarios` array.

- [ ] **Step 4: Simulate cleared storage, then import**

In the browser devtools console, run `localStorage.clear()` and reload the page. Confirm the Retirement tab is back to defaults and the Calculator tab shows "No saved scenarios yet." Click "Import data" and select the file from Step 3. Confirm the page reloads and both the retirement plan (Mutual Fund amount) and the saved scenario are restored.

- [ ] **Step 5: Verify the overwrite-confirmation path**

With the plan still restored from Step 4, change the retirement plan's Mutual Fund amount to a different value (don't save-export). Click "Import data" and re-select the same backup file. Confirm a browser confirmation dialog appears ("This will replace your current retirement plan inputs. Continue?"). Cancel it — confirm the page does *not* reload and your unsaved change is still there. Import again and accept — confirm the page reloads and the plan reverts to the backup's value.

- [ ] **Step 6: Verify an invalid file is rejected cleanly**

Create a text file containing `{"not": "a backup"}`, save it with a `.json` extension, and import it. Confirm an inline error message appears ("This file doesn't look like a Finance Planner backup.") and nothing else on the page changes.

- [ ] **Step 7: No commit for this task** (verification only — if any step fails, fix the relevant task above and re-run its tests before re-verifying here).
