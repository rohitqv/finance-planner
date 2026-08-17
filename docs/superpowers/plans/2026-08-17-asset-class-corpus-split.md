# Asset-Class Corpus Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single "Current corpus" number on the Retirement tab with four fixed asset-class buckets (Mutual Fund, Gold, EPFO, Real Estate), each with its own amount, growth rate, and an "include in retirement calc" toggle.

**Architecture:** `RetirementInput.currentCorpus: number` becomes `RetirementInput.assetClasses: AssetClass[]` (4 fixed entries). A new engine helper (`includedCorpusFutureValue`) grows each included class at its own rate and sums the results; this sum stands in everywhere the old single-rate `currentCorpus` growth used to feed `requiredSip`, `projectedCorpusFromCurrentPlan`, and the accumulation-split chart. A migration path in the localStorage plan loader maps any old-shape saved plan onto the new shape so existing users don't lose their saved corpus.

**Tech Stack:** Next.js, React, TypeScript, Vitest, @testing-library/react.

## Global Constraints

- Asset classes are a **fixed set of 4** (`mutualFund`, `gold`, `epfo`, `realEstate`) — no add/remove/rename UI.
- Monthly investment stays a **single blended number** growing at `preReturnPct` — it is not split per asset class.
- Excluded asset classes (`includeInRetirement: false`) are **fully invisible** to every calculation (corpus, gap, SIP, chart series) — not shown as a separate informational chart line. They remain visible/editable in the input table.
- Default rates: Mutual Fund 12%, Gold 8%, EPFO 8.25%, Real Estate 8%. All default to `includeInRetirement: true`, amount 0.
- Storage stays `localStorage` (`store/retirementPlan.ts`) — no backend/DB change.

---

### Task 1: Engine — asset-class data model and calculations

**Files:**
- Modify: `lib/finance/retirement.ts`
- Test: `lib/finance/__tests__/retirement.test.ts`

**Interfaces:**
- Produces: `AssetClassKey` (`"mutualFund" | "gold" | "epfo" | "realEstate"`), `AssetClass` type, `DEFAULT_ASSET_CLASSES: AssetClass[]`, `includedCorpusFutureValue(assetClasses: AssetClass[], years: number): number`, `includedCorpusAmount(assetClasses: AssetClass[]): number`, updated `RetirementInput` (no `currentCorpus`, has `assetClasses: AssetClass[]`), updated `requiredSip(target: number, years: number, annualReturnPct: number, grownCorpus: number): number` (4th param is now an already-grown corpus, not a raw corpus the function grows itself).

- [ ] **Step 1: Write failing tests for the new engine surface**

Replace the top of `lib/finance/__tests__/retirement.test.ts` (imports and `base` fixture) and add new test cases. Apply this diff:

```ts
import { describe, it, expect } from "vitest";
import {
  computeRetirement, computeAccumulationSplit, requiredSip,
  includedCorpusFutureValue, includedCorpusAmount,
  DEFAULT_ASSET_CLASSES, type RetirementInput, type AssetClass,
} from "@/lib/finance/retirement";
import { accumulate } from "@/lib/finance/accumulation";

function corpusOf(amount: number, ratePct = 12): AssetClass[] {
  return DEFAULT_ASSET_CLASSES.map((a) =>
    a.key === "mutualFund" ? { ...a, amount, ratePct } : a,
  );
}

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50_000, inflationPct: 6,
  preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

Update the two tests that override `currentCorpus` directly:

```ts
  it("currentAge === retirementAge with a corpus already covering the target yields 0, not Infinity", () => {
    const r = computeRetirement({
      ...base, currentAge: 55, retirementAge: 55,
      assetClasses: corpusOf(1_000_000_000, base.preReturnPct),
    });
    expect(Number.isNaN(r.requiredMonthlySip)).toBe(false);
    expect(r.requiredMonthlySip).toBe(0);
  });
```

Also update its sibling test, which had a now-redundant `currentCorpus: 0` override (`base.assetClasses` is already all zero-amount, so the override is dropped rather than translated):

```ts
  it("currentAge === retirementAge yields no NaN and an explicit Infinity requiredMonthlySip when underfunded", () => {
    const r = computeRetirement({ ...base, currentAge: 55, retirementAge: 55 });
    expect(Number.isNaN(r.requiredMonthlySip)).toBe(false);
    expect(Number.isNaN(r.extraSipToCloseGap)).toBe(false);
    // Zero years to accumulate and an unmet target: no SIP amount, however
    // large, can close the gap in zero time.
    expect(r.requiredMonthlySip).toBe(Infinity);
  });
```

```ts
  it("the Required series lands on the corpus target in its final year", () => {
    const input = { ...base, assetClasses: corpusOf(2_000_000, base.preReturnPct) };
    const r = computeRetirement(input);
    const split = computeAccumulationSplit(input, r.requiredMonthlySip);
    const accumYears = input.retirementAge - input.currentAge;
    expect(split.required).toHaveLength(accumYears);
    expect(split.required[accumYears - 1].value).toBeCloseTo(r.corpusNeededAtRetirement, -1);
  });
```

Append these new `describe` blocks at the end of the file:

```ts
describe("includedCorpusFutureValue", () => {
  it("sums each included asset class grown at its own rate", () => {
    const classes: AssetClass[] = [
      { key: "mutualFund", label: "Mutual Fund", amount: 100_000, ratePct: 12, includeInRetirement: true },
      { key: "epfo", label: "EPFO", amount: 200_000, ratePct: 8.25, includeInRetirement: true },
    ];
    const years = 10;
    const expected =
      accumulate({ lumpsum: 100_000, monthlySip: 0, stepUpPct: 0, annualReturn: 12, years, inflationPct: 0 }).futureValue +
      accumulate({ lumpsum: 200_000, monthlySip: 0, stepUpPct: 0, annualReturn: 8.25, years, inflationPct: 0 }).futureValue;
    expect(includedCorpusFutureValue(classes, years)).toBeCloseTo(expected, 6);
  });

  it("excludes asset classes with includeInRetirement: false entirely", () => {
    const classes: AssetClass[] = [
      { key: "mutualFund", label: "Mutual Fund", amount: 100_000, ratePct: 12, includeInRetirement: true },
      { key: "realEstate", label: "Real Estate", amount: 5_000_000, ratePct: 8, includeInRetirement: false },
    ];
    const years = 10;
    const withoutRealEstate = accumulate({
      lumpsum: 100_000, monthlySip: 0, stepUpPct: 0, annualReturn: 12, years, inflationPct: 0,
    }).futureValue;
    expect(includedCorpusFutureValue(classes, years)).toBeCloseTo(withoutRealEstate, 6);
  });
});

describe("includedCorpusAmount", () => {
  it("sums today's amount for included classes only", () => {
    const classes: AssetClass[] = [
      { key: "mutualFund", label: "Mutual Fund", amount: 100_000, ratePct: 12, includeInRetirement: true },
      { key: "gold", label: "Gold", amount: 50_000, ratePct: 8, includeInRetirement: false },
      { key: "epfo", label: "EPFO", amount: 300_000, ratePct: 8.25, includeInRetirement: true },
    ];
    expect(includedCorpusAmount(classes)).toBe(400_000);
  });
});

describe("computeRetirement — excluded asset classes are invisible to calculations", () => {
  it("an excluded high-value asset class does not reduce requiredMonthlySip or raise projectedCorpusFromCurrentPlan", () => {
    const excluded = computeRetirement({
      ...base,
      assetClasses: DEFAULT_ASSET_CLASSES.map((a) =>
        a.key === "realEstate" ? { ...a, amount: 50_000_000, includeInRetirement: false } : a,
      ),
    });
    const zero = computeRetirement(base);
    expect(excluded.requiredMonthlySip).toBeCloseTo(zero.requiredMonthlySip, 6);
    expect(excluded.projectedCorpusFromCurrentPlan).toBeCloseTo(zero.projectedCorpusFromCurrentPlan, 6);
  });

  it("the same asset class included instead of excluded does reduce requiredMonthlySip", () => {
    const included = computeRetirement({
      ...base,
      assetClasses: DEFAULT_ASSET_CLASSES.map((a) =>
        a.key === "realEstate" ? { ...a, amount: 50_000_000, includeInRetirement: true } : a,
      ),
    });
    const zero = computeRetirement(base);
    expect(included.requiredMonthlySip).toBeLessThan(zero.requiredMonthlySip);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: FAIL — `includedCorpusFutureValue`, `includedCorpusAmount`, and `DEFAULT_ASSET_CLASSES` are not exported from `lib/finance/retirement.ts` yet, and `RetirementInput` still requires `currentCorpus` (TypeScript compile errors reported by Vitest).

- [ ] **Step 3: Implement the new data model and calculations**

In `lib/finance/retirement.ts`, replace lines 1–16 (imports through the `RetirementInput` type) with:

```ts
import { accumulate } from "./accumulation";
import type { MonthlyPoint } from "./types";

export type ExpensePhase = { fromAge: number; toAge: number; monthlyExpenseToday: number };

export type AssetClassKey = "mutualFund" | "gold" | "epfo" | "realEstate";
export type AssetClass = {
  key: AssetClassKey;
  label: string;
  amount: number;
  ratePct: number;
  includeInRetirement: boolean;
};

export const DEFAULT_ASSET_CLASSES: AssetClass[] = [
  { key: "mutualFund", label: "Mutual Fund", amount: 0, ratePct: 12, includeInRetirement: true },
  { key: "gold", label: "Gold", amount: 0, ratePct: 8, includeInRetirement: true },
  { key: "epfo", label: "EPFO", amount: 0, ratePct: 8.25, includeInRetirement: true },
  { key: "realEstate", label: "Real Estate", amount: 0, ratePct: 8, includeInRetirement: true },
];

export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  lifespanAge: number;
  currentMonthlyExpense: number;
  inflationPct: number;
  preReturnPct: number;
  postReturnPct: number;
  phases: ExpensePhase[];
  assetClasses: AssetClass[];
  currentMonthlyInvestment: number;
};

// Future value at `years` from now of every asset class with
// includeInRetirement: true, each compounded at its own rate. Excluded
// classes contribute nothing — not zero-weighted, simply skipped.
export function includedCorpusFutureValue(assetClasses: AssetClass[], years: number): number {
  return assetClasses
    .filter((a) => a.includeInRetirement)
    .reduce((sum, a) => sum + accumulate({
      lumpsum: a.amount, monthlySip: 0, stepUpPct: 0,
      annualReturn: a.ratePct, years, inflationPct: 0,
    }).futureValue, 0);
}

// Today's value (no growth) summed over included asset classes only.
export function includedCorpusAmount(assetClasses: AssetClass[]): number {
  return assetClasses
    .filter((a) => a.includeInRetirement)
    .reduce((sum, a) => sum + a.amount, 0);
}
```

Update `requiredSip` (previously took a raw `currentCorpus` and grew it internally at `annualReturnPct`; now takes an already-grown corpus, since each asset class grows at its own rate before this function runs):

```ts
// Solve flat month-end SIP so that grownCorpus + SIP stream reaches target.
// `grownCorpus` is the corpus already projected forward to `years` from now
// (see includedCorpusFutureValue) — this function no longer grows a corpus
// itself, since callers may be summing several asset classes each compounding
// at a different rate.
export function requiredSip(
  target: number, years: number, annualReturnPct: number, grownCorpus: number,
): number {
  const remaining = target - grownCorpus;
  if (remaining <= 0) return 0;
  // With zero (or negative) years there is no time for any monthly SIP to
  // accumulate anything (fvPerUnit below would be 0), so a positive
  // remaining gap can never be closed by a SIP, however large. Return
  // Infinity explicitly here rather than falling through to `remaining / 0`,
  // so this is an intentional "unreachable via SIP" signal, not an
  // accidental division-by-zero artifact.
  if (years <= 0) return Infinity;
  // FV of 1 unit monthly SIP over the horizon (linear in SIP), then scale.
  const fvPerUnit = accumulate({
    lumpsum: 0, monthlySip: 1, stepUpPct: 0,
    annualReturn: annualReturnPct, years, inflationPct: 0,
  }).futureValue;
  return remaining / fvPerUnit;
}
```

Update `computeRetirement` (the SIP-solving and projected-corpus block only — the drawdown-schedule block above it is unchanged):

```ts
  const corpusNeededToday = corpusNeededAtRetirement / Math.pow(1 + infl, accumYears);
  const grownCorpus = includedCorpusFutureValue(input.assetClasses, accumYears);
  const requiredMonthlySip = requiredSip(
    corpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus,
  );

  const investmentStreamFv = accumulate({
    lumpsum: 0, monthlySip: input.currentMonthlyInvestment, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).futureValue;
  const projectedCorpusFromCurrentPlan = grownCorpus + investmentStreamFv;

  const gap = corpusNeededAtRetirement - projectedCorpusFromCurrentPlan;
  const extraSipToCloseGap = gap > 0
    ? requiredSip(corpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus)
        - input.currentMonthlyInvestment
    : 0;
```

Update `computeAccumulationSplit`:

```ts
export function computeAccumulationSplit(
  input: RetirementInput, requiredMonthlySip: number,
): AccumulationSplitResult {
  const accumYears = input.retirementAge - input.currentAge;
  if (accumYears <= 0 || !Number.isFinite(requiredMonthlySip)) {
    return { required: [], surplus: null };
  }

  const sipSeries = accumulate({
    lumpsum: 0, monthlySip: requiredMonthlySip, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).series;

  const assetSeriesList = input.assetClasses
    .filter((a) => a.includeInRetirement)
    .map((a) => accumulate({
      lumpsum: a.amount, monthlySip: 0, stepUpPct: 0,
      annualReturn: a.ratePct, years: accumYears, inflationPct: 0,
    }).series);

  // Every series above was built with the same `years`, so they're the same
  // length with matching `month` at each index — safe to zip-sum by index.
  const required: MonthlyPoint[] = sipSeries.map((point, idx) => ({
    month: point.month,
    invested: assetSeriesList.reduce((sum, s) => sum + s[idx].invested, point.invested),
    value: assetSeriesList.reduce((sum, s) => sum + s[idx].value, point.value),
  }));

  const surplusAmount = input.currentMonthlyInvestment - requiredMonthlySip;
  const surplus = surplusAmount > 0
    ? accumulate({
        lumpsum: 0, monthlySip: surplusAmount, stepUpPct: 0,
        annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
      }).series
    : null;

  return { required, surplus };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: PASS (all tests, including the new ones)

- [ ] **Step 5: Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: errors only in files not yet touched by this task (`store/retirementPlan.ts`, `components/retirement/RetirementInputs.tsx`, `components/retirement/RetirementTab.tsx`, and their test files) — these are fixed in Tasks 2–4. If `lib/finance/retirement.ts` or `lib/finance/__tests__/retirement.test.ts` show any error, fix before proceeding.

- [ ] **Step 6: Commit**

```bash
git add lib/finance/retirement.ts lib/finance/__tests__/retirement.test.ts
git commit -m "feat: split retirement corpus into per-asset-class growth rates"
```

---

### Task 2: Store migration for old-shape saved plans

**Files:**
- Modify: `store/retirementPlan.ts`
- Test: `store/__tests__/retirementPlan.test.ts`

**Interfaces:**
- Consumes: `RetirementInput`, `AssetClass`, `DEFAULT_ASSET_CLASSES` from `lib/finance/retirement.ts` (Task 1).
- Produces: `loadPlan(): RetirementInput | null` (unchanged signature, now migrates old-shape data), `savePlan(plan: RetirementInput): void` (unchanged).

- [ ] **Step 1: Write failing tests**

Replace `store/__tests__/retirementPlan.test.ts` in full:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const KEY = "finance-planner:retirement:v1";

beforeEach(() => localStorage.clear());

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};

describe("retirement plan store", () => {
  it("returns null when empty", () => {
    expect(loadPlan()).toBeNull();
  });

  it("round-trips a plan", () => {
    savePlan(plan);
    expect(loadPlan()?.retirementAge).toBe(55);
    expect(loadPlan()?.assetClasses).toEqual(DEFAULT_ASSET_CLASSES);
  });

  it("migrates an old-shape saved plan (currentCorpus, no assetClasses) into the new asset-class shape", () => {
    const legacy = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 10, postReturnPct: 8,
      phases: [], currentCorpus: 500_000, currentMonthlyInvestment: 20_000,
    };
    localStorage.setItem(KEY, JSON.stringify(legacy));

    const loaded = loadPlan();
    expect(loaded).not.toBeNull();
    expect(loaded!.assetClasses).toHaveLength(4);

    const mutualFund = loaded!.assetClasses.find((a) => a.key === "mutualFund")!;
    expect(mutualFund.amount).toBe(500_000);
    expect(mutualFund.ratePct).toBe(10); // old preReturnPct
    expect(mutualFund.includeInRetirement).toBe(true);

    const gold = loaded!.assetClasses.find((a) => a.key === "gold")!;
    expect(gold.amount).toBe(0);
    expect(gold.includeInRetirement).toBe(true);

    // Non-asset-class fields pass through untouched.
    expect(loaded!.currentMonthlyInvestment).toBe(20_000);
    expect(loaded!.retirementAge).toBe(55);
  });

  it("migrating a legacy plan with no currentCorpus at all defaults the mutual fund amount to 0", () => {
    const legacy = {
      currentAge: 30, retirementAge: 55, lifespanAge: 85,
      currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
      phases: [], currentMonthlyInvestment: 0,
    };
    localStorage.setItem(KEY, JSON.stringify(legacy));

    const loaded = loadPlan();
    const mutualFund = loaded!.assetClasses.find((a) => a.key === "mutualFund")!;
    expect(mutualFund.amount).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run store/__tests__/retirementPlan.test.ts`
Expected: FAIL on the two new migration tests (`loaded!.assetClasses` is `undefined`).

- [ ] **Step 3: Implement the migration in the store**

Replace `store/retirementPlan.ts` in full:

```ts
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
    if (!("assetClasses" in parsed) || !parsed.assetClasses) {
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run store/__tests__/retirementPlan.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add store/retirementPlan.ts store/__tests__/retirementPlan.test.ts
git commit -m "feat: migrate old-shape saved retirement plans to asset-class corpus"
```

---

### Task 3: AssetClassTable UI component

**Files:**
- Create: `components/retirement/AssetClassTable.tsx`
- Test: `components/retirement/__tests__/AssetClassTable.test.tsx`
- Modify: `components/retirement/RetirementInputs.tsx`

**Interfaces:**
- Consumes: `AssetClass`, `includedCorpusAmount` from `lib/finance/retirement.ts` (Task 1); `formatINR` from `lib/finance/format.ts`.
- Produces: `AssetClassTable({ value: AssetClass[], onChange: (v: AssetClass[]) => void })` default export, wired into `RetirementInputs`.

- [ ] **Step 1: Write the failing component test**

Create `components/retirement/__tests__/AssetClassTable.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AssetClassTable from "@/components/retirement/AssetClassTable";
import { DEFAULT_ASSET_CLASSES } from "@/lib/finance/retirement";

describe("AssetClassTable", () => {
  it("renders all four fixed asset classes", () => {
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={vi.fn()} />);
    expect(screen.getByText("Mutual Fund")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("EPFO")).toBeInTheDocument();
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
  });

  it("calls onChange with an updated amount when an amount field changes", () => {
    const onChange = vi.fn();
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("EPFO amount"), { target: { value: "300000" } });
    const updated = onChange.mock.calls[0][0];
    expect(updated.find((a: { key: string }) => a.key === "epfo").amount).toBe(300000);
    // Other classes are untouched.
    expect(updated.find((a: { key: string }) => a.key === "gold").amount).toBe(0);
  });

  it("calls onChange with an updated rate when a rate field changes", () => {
    const onChange = vi.fn();
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("EPFO rate"), { target: { value: "8.25" } });
    const updated = onChange.mock.calls[0][0];
    expect(updated.find((a: { key: string }) => a.key === "epfo").ratePct).toBe(8.25);
  });

  it("calls onChange with includeInRetirement toggled off", () => {
    const onChange = vi.fn();
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Include Real Estate in retirement"));
    const updated = onChange.mock.calls[0][0];
    expect(updated.find((a: { key: string }) => a.key === "realEstate").includeInRetirement).toBe(false);
  });

  it("shows the corpus counted toward retirement as the sum of included amounts only", () => {
    const classes = DEFAULT_ASSET_CLASSES.map((a) => {
      if (a.key === "mutualFund") return { ...a, amount: 100_000, includeInRetirement: true };
      if (a.key === "realEstate") return { ...a, amount: 9_000_000, includeInRetirement: false };
      return a;
    });
    render(<AssetClassTable value={classes} onChange={vi.fn()} />);
    expect(screen.getByText(/current corpus counted toward retirement/i)).toBeInTheDocument();
    expect(screen.getByText("₹1,00,000")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/retirement/__tests__/AssetClassTable.test.tsx`
Expected: FAIL — `Cannot find module '@/components/retirement/AssetClassTable'`

- [ ] **Step 3: Implement the component**

Create `components/retirement/AssetClassTable.tsx`:

```tsx
"use client";
import { includedCorpusAmount, type AssetClass } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function AssetClassTable({
  value, onChange,
}: { value: AssetClass[]; onChange: (v: AssetClass[]) => void }) {
  const update = (key: AssetClass["key"], patch: Partial<AssetClass>) => {
    onChange(value.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  };

  return (
    <div>
      <p className="text-xs text-gray-500">
        Included assets are assumed fully liquid and available to fund
        retirement expenses. Excluded assets aren&apos;t counted in any total
        or calculation below.
      </p>
      <table className="mt-2 w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500">
            <th className="py-1">Asset class</th>
            <th className="py-1">Amount (₹)</th>
            <th className="py-1">Rate (%)</th>
            <th className="py-1">Include</th>
          </tr>
        </thead>
        <tbody>
          {value.map((a) => (
            <tr key={a.key} className="border-t">
              <td className="py-1">{a.label}</td>
              <td className="py-1">
                <input
                  aria-label={`${a.label} amount`}
                  type="number"
                  className="w-full rounded border px-2 py-1"
                  value={a.amount}
                  onChange={(e) => update(a.key, { amount: Number(e.target.value) })}
                />
              </td>
              <td className="py-1">
                <input
                  aria-label={`${a.label} rate`}
                  type="number"
                  className="w-full rounded border px-2 py-1"
                  value={a.ratePct}
                  onChange={(e) => update(a.key, { ratePct: Number(e.target.value) })}
                />
              </td>
              <td className="py-1 text-center">
                <input
                  aria-label={`Include ${a.label} in retirement`}
                  type="checkbox"
                  checked={a.includeInRetirement}
                  onChange={(e) => update(a.key, { includeInRetirement: e.target.checked })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {value.some((a) => a.key === "epfo") ? (
        <p className="mt-1 text-xs text-gray-500">
          8.25% is the current government-declared EPF rate — edit if you
          expect it to change.
        </p>
      ) : null}
      <p className="mt-2 text-sm">
        Current corpus counted toward retirement:{" "}
        <span className="font-semibold">{formatINR(includedCorpusAmount(value))}</span>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/retirement/__tests__/AssetClassTable.test.tsx`
Expected: PASS (all 5 tests)

- [ ] **Step 5: Wire AssetClassTable into RetirementInputs and remove currentCorpus**

Replace `components/retirement/RetirementInputs.tsx` in full:

```tsx
"use client";
import type { RetirementInput } from "@/lib/finance/retirement";
import AssetClassTable from "./AssetClassTable";

const numFields: { key: keyof RetirementInput; label: string; hint?: string }[] = [
  { key: "currentAge", label: "Current age" },
  { key: "retirementAge", label: "Retirement age" },
  { key: "lifespanAge", label: "Lifespan age" },
  { key: "currentMonthlyExpense", label: "Current monthly expense (₹)" },
  { key: "inflationPct", label: "Inflation (%)" },
  { key: "preReturnPct", label: "Return on monthly investment / required SIP (%)" },
  {
    key: "postReturnPct", label: "Post-retirement return (%)",
    hint: "Applied as one blended rate to your whole retirement corpus during drawdown, regardless of which asset classes funded it.",
  },
  { key: "currentMonthlyInvestment", label: "Current monthly investment (₹)" },
];

export default function RetirementInputs({
  value, onChange,
}: { value: RetirementInput; onChange: (v: RetirementInput) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {numFields.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm text-gray-600">{f.label}</span>
            <input
              aria-label={f.label}
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={value[f.key] as number}
              onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
            />
            {f.hint ? <span className="mt-1 block text-xs text-gray-500">{f.hint}</span> : null}
          </label>
        ))}
      </div>
      <AssetClassTable
        value={value.assetClasses}
        onChange={(assetClasses) => onChange({ ...value, assetClasses })}
      />
    </div>
  );
}
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: errors remaining only in `components/retirement/RetirementTab.tsx` and its test files, `components/retirement/__tests__/RetirementAgeCompare.test.tsx` (fixed in Task 4).

- [ ] **Step 7: Commit**

```bash
git add components/retirement/AssetClassTable.tsx components/retirement/__tests__/AssetClassTable.test.tsx components/retirement/RetirementInputs.tsx
git commit -m "feat: add asset-class table UI and wire it into retirement inputs"
```

---

### Task 4: Wire RetirementTab defaults and handoff to the asset-class corpus

**Files:**
- Modify: `components/retirement/RetirementTab.tsx`
- Modify: `components/retirement/__tests__/RetirementTab.test.tsx`
- Modify: `components/retirement/__tests__/RetirementAgeCompare.test.tsx`

**Interfaces:**
- Consumes: `DEFAULT_ASSET_CLASSES`, `includedCorpusAmount` from `lib/finance/retirement.ts` (Task 1).

- [ ] **Step 1: Update the two test fixtures that still reference currentCorpus**

In `components/retirement/__tests__/RetirementAgeCompare.test.tsx`, replace the imports and `base` fixture:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RetirementAgeCompare from "@/components/retirement/RetirementAgeCompare";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

In `components/retirement/__tests__/RetirementTab.test.tsx`, the label for `preReturnPct` changes in Task 3 from "Pre-retirement return" to "Return on monthly investment / required SIP". Update the matching test:

```tsx
  it("includes the plan's own return and inflation assumptions in the handoff payload, not the Calculator's defaults", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    // Change the pre-retirement return away from the value that happens to
    // coincide with the Calculator tab's hardcoded default (12%), so this
    // test can actually distinguish "wired through" from "silently dropped".
    fireEvent.change(screen.getByLabelText(/return on monthly investment/i), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText(/^inflation/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    const arg = onHandoff.mock.calls[0][0];
    expect(arg.annualReturn).toBe(8);
    expect(arg.inflationPct).toBe(5);
  });
```

Add one new test to the same file confirming the handoff lumpsum only counts included asset classes:

```tsx
  it("hands off a lumpsum equal to the sum of included asset-class amounts only", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    fireEvent.change(screen.getByLabelText("Mutual Fund amount"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("Real Estate amount"), { target: { value: "9000000" } });
    fireEvent.click(screen.getByLabelText("Include Real Estate in retirement")); // exclude it
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    const arg = onHandoff.mock.calls[0][0];
    expect(arg.lumpsum).toBe(100000);
  });
```

- [ ] **Step 2: Run the tests to verify the new/changed ones fail**

Run: `npx vitest run components/retirement/__tests__/RetirementTab.test.tsx components/retirement/__tests__/RetirementAgeCompare.test.tsx`
Expected: FAIL — `RetirementTab.tsx` still has `currentCorpus: 0` in its `DEFAULT` object (type error) and still hands off `input.currentCorpus`; the new "hands off a lumpsum..." test fails because `arg.lumpsum` is `undefined`/wrong.

- [ ] **Step 3: Update RetirementTab.tsx**

In `components/retirement/RetirementTab.tsx`, update the import and `DEFAULT` object:

```tsx
import { computeRetirement, computeAccumulationSplit, includedCorpusAmount, DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";
import { loadPlan, savePlan } from "@/store/retirementPlan";

const DEFAULT: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

Update the handoff `onClick` (`lumpsum: input.currentCorpus` → sum of included asset-class amounts), and add the consistency note under the button:

```tsx
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canHandoff}
          title={
            canHandoff
              ? undefined
              : "Set a retirement age greater than current age and a lifespan greater than retirement age first."
          }
          onClick={() => {
            if (!canHandoff) return;
            onHandoff?.({
              monthlySip: Math.round(result.requiredMonthlySip),
              lumpsum: includedCorpusAmount(input.assetClasses),
              years: input.retirementAge - input.currentAge,
              corpusGoal: Math.round(result.corpusNeededAtRetirement),
              annualReturn: input.preReturnPct,
              inflationPct: input.inflationPct,
            });
          }}
        >
          Plan this in Calculator
        </button>
        <p className="text-xs text-gray-500">
          Uses only the asset classes counted toward retirement (see checkboxes above).
        </p>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/retirement/__tests__/RetirementTab.test.tsx components/retirement/__tests__/RetirementAgeCompare.test.tsx`
Expected: PASS (all tests)

- [ ] **Step 5: Run the full test suite and type-check**

Run: `npx vitest run`
Expected: PASS, all files.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/retirement/RetirementTab.tsx components/retirement/__tests__/RetirementTab.test.tsx components/retirement/__tests__/RetirementAgeCompare.test.tsx
git commit -m "feat: hand off included-only asset-class corpus to Calculator tab"
```

---

### Task 5: Manual verification in the browser

**Files:** none (manual QA pass)

- [ ] **Step 1: Start the dev server and open the Retirement tab**

Run: `npm run dev` (or use the project's preview tooling), navigate to the Retirement tab.

- [ ] **Step 2: Verify the asset-class table**

Confirm: the "Current corpus (₹)" field is gone; a 4-row table (Mutual Fund, Gold, EPFO, Real Estate) is present with amount/rate/include columns; entering an EPFO amount and a rate (e.g. 8.25%) updates "Current corpus counted toward retirement" below the table; unchecking a row removes its amount from that total.

- [ ] **Step 3: Verify calculations respond to per-class rates**

Confirm: raising the EPFO rate while EPFO is included lowers "Required monthly SIP" in the results card; unchecking EPFO removes its effect (SIP requirement returns to what it was with EPFO excluded), independent of what its rate is set to.

- [ ] **Step 4: Verify the handoff note and behavior**

Confirm: the caption under "Plan this in Calculator" reads "Uses only the asset classes counted toward retirement (see checkboxes above)"; clicking it with one asset class excluded carries only the included total into the Calculator tab's lumpsum field.

- [ ] **Step 5: Verify migration on a pre-existing saved plan**

In the browser devtools console, seed a legacy plan and reload:

```js
localStorage.setItem("finance-planner:retirement:v1", JSON.stringify({
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 750000, currentMonthlyInvestment: 15000,
}));
```

Reload the page. Confirm: the Mutual Fund row shows amount ₹7,50,000 and rate 12%, all other rows are 0 with their defaults, and no data/console errors appear.

- [ ] **Step 6: No commit for this task** (verification only — if any step fails, fix the relevant task above and re-run its tests before re-verifying here).
