# Bucket-Strategy Retirement Drawdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in "bucket strategy" retirement drawdown mode — a safe (FD-rate) bucket refilled annually from a growth (equity-rate) bucket — alongside the app's existing flat-rate drawdown model, plus a Resources tab linking to reference reading.

**Architecture:** `RetirementInput` gains a `useBucketStrategy` flag and three new fields. `computeRetirement` branches on the flag: off keeps today's single-rate closed-form calculation untouched; on runs a new two-bucket year-by-year simulation (`simulateBucketDrawdown`) whose starting corpus is found via a bracket-and-bisect solver (`solveBucketCorpusNeeded`), mirroring the existing XIRR solver's technique. `DrawdownChart`/`DrawdownTable` render an extra line/columns when they receive the richer bucket row shape, and are unchanged when they don't. A new static `ResourcesTab` and third app tab hold the reference links.

**Tech Stack:** TypeScript, Next.js/React, Vitest + @testing-library/react, Recharts.

## Global Constraints

- No AI/model calls anywhere in this feature — the whole calculation is deterministic arithmetic (spec: "Why deterministic, not AI").
- `useBucketStrategy` defaults to `false`; when off, every existing code path and test must behave exactly as before this plan.
- New rate/size inputs (`bucketYears`, `safeBucketRatePct`, `growthBucketRatePct`) are dedicated fields, independent of `assetClasses` and `postReturnPct`.
- Reference links are links only — no reproduced article content (copyright).
- Defaults: `bucketYears: 5`, `safeBucketRatePct: 7`, `growthBucketRatePct: 11`.

---

## Task 1: Extend `RetirementInput` with bucket-strategy fields

**Files:**
- Modify: `lib/finance/retirement.ts:23-34` (the `RetirementInput` type)
- Modify: `components/retirement/RetirementTab.tsx:14-18` (the `DEFAULT` constant)
- Modify: `lib/finance/__tests__/retirement.test.ts:15-19` (the `base` fixture)
- Modify: `store/__tests__/retirementPlan.test.ts:9-13` (the `plan` fixture)
- Modify: `components/__tests__/BackupRestore.test.tsx:11-15` (the `plan` fixture)
- Modify: `components/retirement/__tests__/RetirementAgeCompare.test.tsx:6-10` (the `base` fixture)
- Modify: `lib/backup/__tests__/backup.test.ts:6-10` (the `plan` fixture)

**Interfaces:**
- Produces: `RetirementInput` now requires `useBucketStrategy: boolean; bucketYears: number; safeBucketRatePct: number; growthBucketRatePct: number;` — every later task relies on these existing.

This task only widens the type and updates every place that builds a full `RetirementInput` object literal, so the codebase keeps compiling. No new behavior yet (nothing reads the new fields).

- [ ] **Step 1: Add the four fields to `RetirementInput`**

In `lib/finance/retirement.ts`, replace:

```ts
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
```

with:

```ts
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
  useBucketStrategy: boolean;
  bucketYears: number;
  safeBucketRatePct: number;
  growthBucketRatePct: number;
};
```

- [ ] **Step 2: Update the app's default plan**

In `components/retirement/RetirementTab.tsx`, replace:

```ts
const DEFAULT: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

with:

```ts
const DEFAULT: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};
```

- [ ] **Step 3: Update every test fixture that builds a full `RetirementInput`**

In `lib/finance/__tests__/retirement.test.ts`, replace:

```ts
const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50_000, inflationPct: 6,
  preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

with:

```ts
const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50_000, inflationPct: 6,
  preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};
```

In `store/__tests__/retirementPlan.test.ts`, replace:

```ts
const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

with:

```ts
const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};
```

In `components/__tests__/BackupRestore.test.tsx`, replace:

```ts
const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

with:

```ts
const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};
```

In `components/retirement/__tests__/RetirementAgeCompare.test.tsx`, replace:

```ts
const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

with:

```ts
const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};
```

In `lib/backup/__tests__/backup.test.ts`, replace:

```ts
const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};
```

with:

```ts
const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};
```

- [ ] **Step 4: Verify the whole codebase still compiles and every existing test still passes**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm test`
Expected: every existing test still passes (this task adds no new tests — it's a pure type/fixture widening, so the suite's pass count is unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/finance/retirement.ts components/retirement/RetirementTab.tsx \
  lib/finance/__tests__/retirement.test.ts store/__tests__/retirementPlan.test.ts \
  components/__tests__/BackupRestore.test.tsx components/retirement/__tests__/RetirementAgeCompare.test.tsx \
  lib/backup/__tests__/backup.test.ts
git commit -m "feat: add bucket-strategy fields to RetirementInput"
```

---

## Task 2: Bucket-strategy year-by-year simulation

**Files:**
- Modify: `lib/finance/retirement.ts` (add `BucketDrawdownRow`, `isBucketDrawdown`, and the simulation functions, placed after `annualExpenseTodayForAge` and before `requiredSip`)
- Modify: `lib/finance/__tests__/retirement.test.ts` (new `describe` blocks)

**Interfaces:**
- Consumes: `RetirementInput` (Task 1), `DrawdownRow` and `annualExpenseTodayForAge` (already in `retirement.ts`).
- Produces: `BucketDrawdownRow` type, `isBucketDrawdown(rows): rows is BucketDrawdownRow[]`, `simulateBucketDrawdown(input, startingCorpus): BucketDrawdownRow[]` — Task 3 and Task 4 both call these.

- [ ] **Step 1: Write the failing tests**

Add to `lib/finance/__tests__/retirement.test.ts` (extend the existing import line to include the new exports, and add these `describe` blocks):

```ts
import {
  computeRetirement, computeAccumulationSplit, requiredSip,
  includedCorpusFutureValue, includedCorpusAmount,
  simulateBucketDrawdown, isBucketDrawdown,
  DEFAULT_ASSET_CLASSES, type RetirementInput, type AssetClass,
} from "@/lib/finance/retirement";
```

```ts
describe("simulateBucketDrawdown", () => {
  // A small, hand-computable scenario: 3 years of retirement (60, 61, 62),
  // flat (uninflated) expense so every year withdraws exactly 12,00,000,
  // round rates so the arithmetic is easy to verify by hand.
  const bucketBase: RetirementInput = {
    ...base,
    currentAge: 60, retirementAge: 60, lifespanAge: 62,
    currentMonthlyExpense: 100_000, inflationPct: 0,
    useBucketStrategy: true, bucketYears: 2, safeBucketRatePct: 10, growthBucketRatePct: 20,
  };

  it("withdraws from the safe bucket, grows both buckets, and refills the safe bucket from growth (hand-computed)", () => {
    // Initial split of 50,00,000: safe = 2 years' expense = 24,00,000, growth = 26,00,000.
    // Year 60: safe (24L-12L)*1.10=13.2L, growth 26L*1.20=31.2L, refill target
    //   (next 2 yrs) = 24L, transfer 10.8L growth->safe => safe 24L, growth 20.4L.
    // Year 61: safe (24L-12L)*1.10=13.2L, growth 20.4L*1.20=24.48L, refill
    //   target (next 1 yr) = 12L, transfer -1.2L (safe->growth) => safe 12L, growth 25.68L.
    // Year 62 (last): safe (12L-12L)*1.10=0, growth 25.68L*1.20=30.816L, refill
    //   target (0 yrs left) = 0, no transfer => safe 0, growth 30.816L.
    const rows = simulateBucketDrawdown(bucketBase, 5_000_000);
    expect(rows).toHaveLength(3);

    expect(rows[0].age).toBe(60);
    expect(rows[0].safeBalance).toBeCloseTo(2_400_000, 0);
    expect(rows[0].growthBalance).toBeCloseTo(2_040_000, 0);

    expect(rows[1].age).toBe(61);
    expect(rows[1].safeBalance).toBeCloseTo(1_200_000, 0);
    expect(rows[1].growthBalance).toBeCloseTo(2_568_000, 0);

    expect(rows[2].age).toBe(62);
    expect(rows[2].safeBalance).toBeCloseTo(0, 0);
    expect(rows[2].growthBalance).toBeCloseTo(3_081_600, 0);
    expect(rows[2].corpusBalance).toBeCloseTo(3_081_600, 0);
  });

  it("floors both buckets at 0 when the starting corpus can't cover expenses, instead of going negative", () => {
    const rows = simulateBucketDrawdown(bucketBase, 0);
    for (const row of rows) {
      expect(row.safeBalance).toBeGreaterThanOrEqual(0);
      expect(row.growthBalance).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("isBucketDrawdown", () => {
  it("distinguishes bucket rows from flat-rate rows", () => {
    const bucketBase: RetirementInput = {
      ...base,
      currentAge: 60, retirementAge: 60, lifespanAge: 62,
      currentMonthlyExpense: 100_000, inflationPct: 0,
      useBucketStrategy: true, bucketYears: 2, safeBucketRatePct: 10, growthBucketRatePct: 20,
    };
    expect(isBucketDrawdown(simulateBucketDrawdown(bucketBase, 5_000_000))).toBe(true);
    expect(isBucketDrawdown(computeRetirement(base).drawdown)).toBe(false);
    expect(isBucketDrawdown([])).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: FAIL — `simulateBucketDrawdown` and `isBucketDrawdown` are not exported yet.

- [ ] **Step 3: Implement the simulation**

In `lib/finance/retirement.ts`, add this block after `annualExpenseTodayForAge` (i.e. right before the `requiredSip` function):

```ts
export type BucketDrawdownRow = DrawdownRow & { safeBalance: number; growthBalance: number };

export function isBucketDrawdown(
  rows: DrawdownRow[] | BucketDrawdownRow[],
): rows is BucketDrawdownRow[] {
  return rows.length > 0 && "safeBalance" in rows[0];
}

type BucketState = { safeBalance: number; growthBalance: number };
type BucketMode = "raw" | "display";

function bucketYearlyExpense(input: RetirementInput, age: number, infl: number): number {
  return annualExpenseTodayForAge(input, age) * Math.pow(1 + infl, age - input.currentAge);
}

// Sum of the inflated expenses for the `bucketYears` years *after* `age`,
// capped at however many years remain until lifespanAge. This is the
// safe bucket's target size once this year's withdrawal is done.
function bucketRefillTarget(input: RetirementInput, age: number, infl: number): number {
  const remainingYears = Math.max(0, input.lifespanAge - age);
  const span = Math.min(input.bucketYears, remainingYears);
  let target = 0;
  for (let k = 1; k <= span; k++) target += bucketYearlyExpense(input, age + k, infl);
  return target;
}

// One year of bucket-strategy drawdown: withdraw this year's expense from
// the safe bucket, grow both buckets at their own rate, then rebalance the
// safe bucket back to `bucketRefillTarget`, moving the difference to/from
// the growth bucket. In "display" mode, a transfer *into* the safe bucket
// is capped at the growth bucket's balance (money can't come from
// nowhere) and both balances floor at 0 for the row shown to the user; in
// "raw" mode (used only by solveBucketCorpusNeeded) neither the cap nor
// the floor is applied, so the ending balance stays a smooth, monotonic
// function of the starting corpus that bisection can search over.
function stepBucketYear(
  input: RetirementInput, state: BucketState, age: number, infl: number, mode: BucketMode,
): BucketState {
  const expense = bucketYearlyExpense(input, age, infl);
  let safeBalance = (state.safeBalance - expense) * (1 + input.safeBucketRatePct / 100);
  let growthBalance = state.growthBalance * (1 + input.growthBucketRatePct / 100);

  const target = bucketRefillTarget(input, age, infl);
  const desiredTransfer = target - safeBalance;
  const transfer = mode === "display" && desiredTransfer > 0
    ? Math.min(desiredTransfer, growthBalance)
    : desiredTransfer;
  safeBalance += transfer;
  growthBalance -= transfer;

  if (mode === "display") {
    safeBalance = Math.max(0, safeBalance);
    growthBalance = Math.max(0, growthBalance);
  }
  return { safeBalance, growthBalance };
}

// Split the starting corpus at retirement: `bucketYears` worth of expense
// (starting with this year's) goes to the safe bucket, the rest to growth.
function initialBucketSplit(
  input: RetirementInput, startingCorpus: number, infl: number, mode: BucketMode,
): BucketState {
  const span = Math.min(input.bucketYears, input.lifespanAge - input.retirementAge + 1);
  let initialTarget = 0;
  for (let k = 0; k < span; k++) {
    initialTarget += bucketYearlyExpense(input, input.retirementAge + k, infl);
  }
  const safeBalance = Math.min(startingCorpus, initialTarget);
  const growthBalanceRaw = startingCorpus - initialTarget;
  return { safeBalance, growthBalance: mode === "display" ? Math.max(0, growthBalanceRaw) : growthBalanceRaw };
}

type BucketYearRow = {
  age: number; yearsFromNow: number; annualExpenseToday: number; annualExpenseInflated: number;
  safeBalance: number; growthBalance: number;
};

function runBucketYears(input: RetirementInput, startingCorpus: number, mode: BucketMode): BucketYearRow[] {
  const infl = input.inflationPct / 100;
  let state = initialBucketSplit(input, startingCorpus, infl, mode);
  const rows: BucketYearRow[] = [];
  for (let age = input.retirementAge; age <= input.lifespanAge; age++) {
    state = stepBucketYear(input, state, age, infl, mode);
    rows.push({
      age, yearsFromNow: age - input.currentAge,
      annualExpenseToday: annualExpenseTodayForAge(input, age),
      annualExpenseInflated: bucketYearlyExpense(input, age, infl),
      safeBalance: state.safeBalance, growthBalance: state.growthBalance,
    });
  }
  return rows;
}

export function simulateBucketDrawdown(input: RetirementInput, startingCorpus: number): BucketDrawdownRow[] {
  const nowYear = new Date().getFullYear();
  return runBucketYears(input, startingCorpus, "display").map((r) => ({
    age: r.age, year: nowYear + r.yearsFromNow, yearsFromNow: r.yearsFromNow,
    annualExpenseToday: r.annualExpenseToday, annualExpenseInflated: r.annualExpenseInflated,
    corpusBalance: r.safeBalance + r.growthBalance,
    safeBalance: r.safeBalance, growthBalance: r.growthBalance,
  }));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: PASS for all tests in `simulateBucketDrawdown` and `isBucketDrawdown`, and all pre-existing tests in the file still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/retirement.ts lib/finance/__tests__/retirement.test.ts
git commit -m "feat: add bucket-strategy drawdown simulation"
```

---

## Task 3: Solve the starting corpus via bracket-and-bisect

**Files:**
- Modify: `lib/finance/retirement.ts` (add `solveBucketCorpusNeeded`, placed after `simulateBucketDrawdown`)
- Modify: `lib/finance/__tests__/retirement.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `runBucketYears` (private to `retirement.ts`, from Task 2), `bucketYearlyExpense` (private, Task 2).
- Produces: `solveBucketCorpusNeeded(input): number` — Task 4 calls this to get `corpusNeededAtRetirement` in bucket mode.

- [ ] **Step 1: Write the failing tests**

Add to `lib/finance/__tests__/retirement.test.ts` (extend the import to add `solveBucketCorpusNeeded`):

```ts
import {
  computeRetirement, computeAccumulationSplit, requiredSip,
  includedCorpusFutureValue, includedCorpusAmount,
  simulateBucketDrawdown, isBucketDrawdown, solveBucketCorpusNeeded,
  DEFAULT_ASSET_CLASSES, type RetirementInput, type AssetClass,
} from "@/lib/finance/retirement";
```

```ts
describe("solveBucketCorpusNeeded", () => {
  const bucketBase: RetirementInput = {
    ...base,
    currentAge: 60, retirementAge: 60, lifespanAge: 62,
    currentMonthlyExpense: 100_000, inflationPct: 0,
    useBucketStrategy: true, bucketYears: 2, safeBucketRatePct: 10, growthBucketRatePct: 20,
  };

  it("solves a starting corpus that depletes to ~0 exactly at lifespanAge", () => {
    const corpus = solveBucketCorpusNeeded(bucketBase);
    const rows = simulateBucketDrawdown(bucketBase, corpus);
    expect(rows[rows.length - 1].corpusBalance).toBeCloseTo(0, 0);
  });

  it("a larger starting corpus than the solved amount ends with money left over", () => {
    const corpus = solveBucketCorpusNeeded(bucketBase);
    const rows = simulateBucketDrawdown(bucketBase, corpus + 1_000_000);
    expect(rows[rows.length - 1].corpusBalance).toBeGreaterThan(0);
  });

  it("returns 0 when lifespanAge is before retirementAge, instead of crashing", () => {
    const invalid: RetirementInput = { ...bucketBase, lifespanAge: 59 };
    expect(solveBucketCorpusNeeded(invalid)).toBe(0);
  });

  it("converges for a realistic multi-decade horizon (30 years)", () => {
    const longHorizon: RetirementInput = {
      ...base, useBucketStrategy: true, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
    };
    const corpus = solveBucketCorpusNeeded(longHorizon);
    expect(corpus).toBeGreaterThan(0);
    const rows = simulateBucketDrawdown(longHorizon, corpus);
    expect(rows[rows.length - 1].corpusBalance).toBeCloseTo(0, -2); // within ~50 rupees
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: FAIL — `solveBucketCorpusNeeded` is not exported yet.

- [ ] **Step 3: Implement the solver**

In `lib/finance/retirement.ts`, add this function directly after `simulateBucketDrawdown`:

```ts
// Bracket-and-bisect on the starting corpus (same technique as the XIRR
// solver in lib/finance/returns.ts, but the search variable here is a
// rupee amount, not a rate): find the starting corpus whose raw
// (unclamped) ending balance at lifespanAge is exactly 0. Ending balance
// is monotonically increasing in startingCorpus under positive bucket
// rates, so a sign change always brackets the root.
export function solveBucketCorpusNeeded(input: RetirementInput): number {
  if (input.lifespanAge < input.retirementAge) return 0;

  const endingBalance = (corpus: number): number => {
    const rows = runBucketYears(input, corpus, "raw");
    const last = rows[rows.length - 1];
    return last.safeBalance + last.growthBalance;
  };

  let lo = 0;
  let hi = Math.max(1, bucketYearlyExpense(input, input.retirementAge, input.inflationPct / 100));
  for (let iter = 0; iter < 100 && endingBalance(hi) < 0; iter++) hi *= 2;

  for (let iter = 0; iter < 100; iter++) {
    if (hi - lo < 1e-6) break;
    const mid = (lo + hi) / 2;
    if (endingBalance(mid) < 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: PASS for all tests in `solveBucketCorpusNeeded`, and all pre-existing tests in the file still pass.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/retirement.ts lib/finance/__tests__/retirement.test.ts
git commit -m "feat: solve bucket-strategy corpus via bracket-and-bisect"
```

---

## Task 4: Wire bucket strategy into `computeRetirement`

**Files:**
- Modify: `lib/finance/retirement.ts` (the `RetirementResult` type, and the `computeRetirement` function — both after the code added in Tasks 2–3, so their exact line numbers have shifted from the original file; locate them by name/content, not line number)
- Modify: `lib/finance/__tests__/retirement.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `solveBucketCorpusNeeded`, `simulateBucketDrawdown`, `isBucketDrawdown`, `BucketDrawdownRow` (Tasks 2–3).
- Produces: `RetirementResult.drawdown: DrawdownRow[] | BucketDrawdownRow[]` — Tasks 7–8 (chart/table) depend on this union type.

- [ ] **Step 1: Write the failing tests**

Add to `lib/finance/__tests__/retirement.test.ts`:

```ts
describe("computeRetirement — bucket strategy mode", () => {
  const bucketInput: RetirementInput = {
    ...base,
    useBucketStrategy: true, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
  };

  it("returns BucketDrawdownRow[] (with safe/growth balances) when useBucketStrategy is true", () => {
    const r = computeRetirement(bucketInput);
    expect(isBucketDrawdown(r.drawdown)).toBe(true);
  });

  it("still returns plain DrawdownRow[] (no safeBalance) when useBucketStrategy is false", () => {
    const r = computeRetirement(base);
    expect(isBucketDrawdown(r.drawdown)).toBe(false);
  });

  it("depletes to ~0 at lifespanAge in bucket mode, mirroring the flat-rate round-trip test above", () => {
    const r = computeRetirement(bucketInput);
    const last = r.drawdown[r.drawdown.length - 1];
    expect(last.corpusBalance).toBeCloseTo(0, -2); // within ~50 rupees
  });

  it("requiredMonthlySip, invested alongside the projected corpus, reaches corpusNeededAtRetirement", () => {
    const r = computeRetirement(bucketInput);
    const accumYears = bucketInput.retirementAge - bucketInput.currentAge;
    const grownCorpus = includedCorpusFutureValue(bucketInput.assetClasses, accumYears);
    const sipFv = accumulate({
      lumpsum: 0, monthlySip: r.requiredMonthlySip, stepUpPct: 0,
      annualReturn: bucketInput.preReturnPct, years: accumYears, inflationPct: 0,
    }).futureValue;
    expect(grownCorpus + sipFv).toBeCloseTo(r.corpusNeededAtRetirement, -1);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: FAIL — `computeRetirement` doesn't branch on `useBucketStrategy` yet, so `r.drawdown` never has `safeBalance`.

- [ ] **Step 3: Update `RetirementResult` and `computeRetirement`**

In `lib/finance/retirement.ts`, replace the `RetirementResult` type:

```ts
export type RetirementResult = {
  corpusNeededAtRetirement: number;
  corpusNeededToday: number;
  requiredMonthlySip: number;
  projectedCorpusFromCurrentPlan: number;
  gap: number;
  extraSipToCloseGap: number;
  drawdown: DrawdownRow[];
};
```

with:

```ts
export type RetirementResult = {
  corpusNeededAtRetirement: number;
  corpusNeededToday: number;
  requiredMonthlySip: number;
  projectedCorpusFromCurrentPlan: number;
  gap: number;
  extraSipToCloseGap: number;
  drawdown: DrawdownRow[] | BucketDrawdownRow[];
};
```

Then replace the whole `computeRetirement` function:

```ts
export function computeRetirement(input: RetirementInput): RetirementResult {
  const accumYears = input.retirementAge - input.currentAge;
  const nowYear = new Date().getFullYear();
  const infl = input.inflationPct / 100;
  const post = input.postReturnPct / 100;

  // Build the drawdown schedule (retirement age .. lifespan age inclusive).
  const drawdown: DrawdownRow[] = [];
  let corpusNeededAtRetirement = 0;
  const rows: { age: number; yearsFromNow: number; annualExpenseToday: number; annualExpenseInflated: number }[] = [];
  for (let age = input.retirementAge; age <= input.lifespanAge; age++) {
    const yearsFromNow = age - input.currentAge;
    const annualExpenseToday = annualExpenseTodayForAge(input, age);
    const annualExpenseInflated = annualExpenseToday * Math.pow(1 + infl, yearsFromNow);
    rows.push({ age, yearsFromNow, annualExpenseToday, annualExpenseInflated });
    // Present value at retirement of this year's expense (expense drawn at year start).
    const yearsIntoRetirement = age - input.retirementAge;
    corpusNeededAtRetirement += annualExpenseInflated / Math.pow(1 + post, yearsIntoRetirement);
  }

  // Fill running balance for display.
  let bal = corpusNeededAtRetirement;
  for (const r of rows) {
    const startBal = bal;
    bal = startBal - r.annualExpenseInflated; // withdraw at start of year
    bal = bal * (1 + post);                   // grow for the year
    drawdown.push({
      age: r.age, year: nowYear + r.yearsFromNow, yearsFromNow: r.yearsFromNow,
      annualExpenseToday: r.annualExpenseToday, annualExpenseInflated: r.annualExpenseInflated,
      corpusBalance: Math.max(0, startBal - r.annualExpenseInflated),
    });
  }

  let finalCorpusNeededAtRetirement = corpusNeededAtRetirement;
  let finalDrawdown: DrawdownRow[] | BucketDrawdownRow[] = drawdown;
  if (input.useBucketStrategy) {
    finalCorpusNeededAtRetirement = solveBucketCorpusNeeded(input);
    finalDrawdown = simulateBucketDrawdown(input, finalCorpusNeededAtRetirement);
  }

  const corpusNeededToday = finalCorpusNeededAtRetirement / Math.pow(1 + infl, accumYears);
  const grownCorpus = includedCorpusFutureValue(input.assetClasses, accumYears);
  const requiredMonthlySip = requiredSip(
    finalCorpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus,
  );

  const investmentStreamFv = accumulate({
    lumpsum: 0, monthlySip: input.currentMonthlyInvestment, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).futureValue;
  const projectedCorpusFromCurrentPlan = grownCorpus + investmentStreamFv;

  const gap = finalCorpusNeededAtRetirement - projectedCorpusFromCurrentPlan;
  const extraSipToCloseGap = gap > 0
    ? requiredSip(finalCorpusNeededAtRetirement, accumYears, input.preReturnPct, grownCorpus)
        - input.currentMonthlyInvestment
    : 0;

  return {
    corpusNeededAtRetirement: finalCorpusNeededAtRetirement,
    corpusNeededToday,
    requiredMonthlySip,
    projectedCorpusFromCurrentPlan,
    gap,
    extraSipToCloseGap: Math.max(0, extraSipToCloseGap),
    drawdown: finalDrawdown,
  };
}
```

This keeps the original flat-rate loop exactly as it was (computing `corpusNeededAtRetirement`/`drawdown` unconditionally), then — only when `useBucketStrategy` is on — overwrites those two values with the bucket-solved ones before the shared accumulation-phase math (SIP, gap, etc.) runs. The flat-rate loop's output is simply discarded in that case; this is intentionally the simplest correct change (computing it twice is cheap and it keeps the diff small), not a perf-sensitive path.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run lib/finance/__tests__/retirement.test.ts`
Expected: PASS for all tests, including every pre-existing test in the file (the flat-rate path is byte-for-byte unchanged).

- [ ] **Step 5: Commit**

```bash
git add lib/finance/retirement.ts lib/finance/__tests__/retirement.test.ts
git commit -m "feat: wire bucket-strategy drawdown into computeRetirement"
```

---

## Task 5: Backfill bucket-strategy defaults for saved plans

**Files:**
- Modify: `store/retirementPlan.ts:35-48` (the `loadPlan` function)
- Modify: `store/__tests__/retirementPlan.test.ts` (new tests)

**Interfaces:**
- Consumes: `RetirementInput` (Task 1).
- Produces: `loadPlan()` always returns an object with all four bucket-strategy fields set, even for plans saved before this feature shipped.

Without this, a plan saved before this feature shipped would load with `bucketYears: undefined` etc. — harmless while `useBucketStrategy` is falsy, but the moment a user checks the box, `RetirementInputs`' number fields would render `undefined`/blank instead of the documented defaults.

- [ ] **Step 1: Write the failing tests**

Add to `store/__tests__/retirementPlan.test.ts`:

```ts
it("backfills bucket-strategy defaults for a plan saved before that feature shipped", () => {
  const preFeaturePlan = {
    currentAge: 30, retirementAge: 55, lifespanAge: 85,
    currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
    phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  };
  localStorage.setItem(KEY, JSON.stringify(preFeaturePlan));

  const loaded = loadPlan();
  expect(loaded!.useBucketStrategy).toBe(false);
  expect(loaded!.bucketYears).toBe(5);
  expect(loaded!.safeBucketRatePct).toBe(7);
  expect(loaded!.growthBucketRatePct).toBe(11);
});

it("keeps a saved bucket-strategy setting rather than overwriting it with the default", () => {
  const planWithBuckets = {
    ...plan, useBucketStrategy: true, bucketYears: 3, safeBucketRatePct: 6, growthBucketRatePct: 12,
  };
  localStorage.setItem(KEY, JSON.stringify(planWithBuckets));

  const loaded = loadPlan();
  expect(loaded!.useBucketStrategy).toBe(true);
  expect(loaded!.bucketYears).toBe(3);
  expect(loaded!.safeBucketRatePct).toBe(6);
  expect(loaded!.growthBucketRatePct).toBe(12);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run store/__tests__/retirementPlan.test.ts`
Expected: FAIL — the first new test fails because `loaded!.bucketYears` is `undefined`, not `5`.

- [ ] **Step 3: Backfill defaults in `loadPlan`**

In `store/retirementPlan.ts`, replace:

```ts
export function loadPlan(): RetirementInput | null {
  if (!canUse()) return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LegacyPlan | RetirementInput;
    if (!("assetClasses" in parsed) || parsed.assetClasses == null) {
      return migrateLegacyPlan(parsed as LegacyPlan);
    }
    return { ...parsed, assetClasses: reconcileAssetClasses(parsed.assetClasses) } as RetirementInput;
  } catch {
    return null;
  }
}
```

with:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run store/__tests__/retirementPlan.test.ts`
Expected: PASS for all tests, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add store/retirementPlan.ts store/__tests__/retirementPlan.test.ts
git commit -m "fix: backfill bucket-strategy defaults for plans saved before the feature shipped"
```

---

## Task 6: `RetirementInputs` — bucket-strategy checkbox and fields

**Files:**
- Modify: `components/retirement/RetirementInputs.tsx`
- Create: `components/retirement/__tests__/RetirementInputs.test.tsx`

**Interfaces:**
- Consumes: `RetirementInput` (Task 1).
- Produces: no new exports — a leaf UI component the user interacts with directly.

- [ ] **Step 1: Write the failing test**

Create `components/retirement/__tests__/RetirementInputs.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RetirementInputs from "@/components/retirement/RetirementInputs";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const value: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};

describe("RetirementInputs — bucket strategy", () => {
  it("hides the bucket-strategy fields when the checkbox is off", () => {
    render(<RetirementInputs value={value} onChange={vi.fn()} />);
    expect(screen.queryByLabelText("Years of expense kept safe")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Safe bucket rate (%)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Growth bucket rate (%)")).not.toBeInTheDocument();
  });

  it("calls onChange with useBucketStrategy: true when the checkbox is checked", () => {
    const onChange = vi.fn();
    render(<RetirementInputs value={value} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Use bucket strategy for drawdown"));
    expect(onChange).toHaveBeenCalledWith({ ...value, useBucketStrategy: true });
  });

  it("shows and edits the bucket-strategy fields when the checkbox is on", () => {
    const onChange = vi.fn();
    const checked = { ...value, useBucketStrategy: true };
    render(<RetirementInputs value={checked} onChange={onChange} />);

    expect(screen.getByLabelText("Years of expense kept safe")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Safe bucket rate (%)"), { target: { value: "6.5" } });
    expect(onChange).toHaveBeenCalledWith({ ...checked, safeBucketRatePct: 6.5 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/retirement/__tests__/RetirementInputs.test.tsx`
Expected: FAIL — the checkbox and bucket fields don't exist yet.

- [ ] **Step 3: Add the checkbox and conditional fields**

In `components/retirement/RetirementInputs.tsx`, replace the whole file with:

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
    hint: "Applied as one blended rate to your whole retirement corpus during drawdown, regardless of which asset classes funded it. Ignored when bucket strategy is on, below.",
  },
  { key: "currentMonthlyInvestment", label: "Current monthly investment (₹)" },
];

const bucketFields: { key: keyof RetirementInput; label: string }[] = [
  { key: "bucketYears", label: "Years of expense kept safe" },
  { key: "safeBucketRatePct", label: "Safe bucket rate (%)" },
  { key: "growthBucketRatePct", label: "Growth bucket rate (%)" },
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
      <label className="flex items-center gap-2 text-sm">
        <input
          aria-label="Use bucket strategy for drawdown"
          type="checkbox"
          checked={value.useBucketStrategy}
          onChange={(e) => onChange({ ...value, useBucketStrategy: e.target.checked })}
        />
        Use bucket strategy for drawdown
      </label>
      {value.useBucketStrategy ? (
        <div className="grid grid-cols-3 gap-3">
          {bucketFields.map((f) => (
            <label key={f.key} className="block">
              <span className="text-sm text-gray-600">{f.label}</span>
              <input
                aria-label={f.label}
                type="number"
                className="mt-1 w-full rounded border px-3 py-2"
                value={value[f.key] as number}
                onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
              />
            </label>
          ))}
        </div>
      ) : null}
      <AssetClassTable
        value={value.assetClasses}
        onChange={(assetClasses) => onChange({ ...value, assetClasses })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/retirement/__tests__/RetirementInputs.test.tsx`
Expected: PASS for all three tests.

- [ ] **Step 5: Commit**

```bash
git add components/retirement/RetirementInputs.tsx components/retirement/__tests__/RetirementInputs.test.tsx
git commit -m "feat: add bucket-strategy checkbox and fields to RetirementInputs"
```

---

## Task 7: `DrawdownChart` — two-line rendering for bucket rows

**Files:**
- Modify: `components/retirement/DrawdownChart.tsx`
- Create: `components/retirement/__tests__/DrawdownChart.test.tsx`

**Interfaces:**
- Consumes: `DrawdownRow`, `BucketDrawdownRow`, `isBucketDrawdown` (Tasks 2 and 4).
- Produces: no new exports — a leaf UI component.

- [ ] **Step 1: Write the failing test**

Create `components/retirement/__tests__/DrawdownChart.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DrawdownChart from "@/components/retirement/DrawdownChart";
import type { DrawdownRow, BucketDrawdownRow } from "@/lib/finance/retirement";

const flatRows: DrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000 },
];

const bucketRows: BucketDrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000, safeBalance: 2_000_000, growthBalance: 3_000_000 },
];

describe("DrawdownChart", () => {
  it("renders a single-series chart (no legend) for plain DrawdownRow[]", () => {
    const { container } = render(<DrawdownChart rows={flatRows} />);
    expect(container.querySelector("svg, .recharts-wrapper")).toBeTruthy();
    expect(container.querySelector(".recharts-legend-wrapper")).toBeFalsy();
  });

  it("renders a two-line chart (with legend) for BucketDrawdownRow[]", () => {
    const { container } = render(<DrawdownChart rows={bucketRows} />);
    expect(container.querySelector("svg, .recharts-wrapper")).toBeTruthy();
    expect(container.querySelector(".recharts-legend-wrapper")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/retirement/__tests__/DrawdownChart.test.tsx`
Expected: FAIL — `DrawdownChart` doesn't accept `BucketDrawdownRow[]` or render a legend yet (and the `rows` prop type doesn't allow it).

- [ ] **Step 3: Extend the chart**

Replace `components/retirement/DrawdownChart.tsx` with:

```tsx
"use client";
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { isBucketDrawdown, type DrawdownRow, type BucketDrawdownRow } from "@/lib/finance/retirement";

export default function DrawdownChart({ rows }: { rows: DrawdownRow[] | BucketDrawdownRow[] }) {
  if (isBucketDrawdown(rows)) {
    const data = rows.map((r) => ({
      age: r.age, "Growth bucket": Math.round(r.growthBalance), "Safe bucket": Math.round(r.safeBalance),
    }));
    return (
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="age" />
            <YAxis width={80} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Growth bucket" stroke="#16a34a" dot={false} />
            <Line type="monotone" dataKey="Safe bucket" stroke="#d97706" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const data = rows.map((r) => ({ age: r.age, Corpus: Math.round(r.corpusBalance) }));
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis dataKey="age" />
          <YAxis width={80} />
          <Tooltip />
          <Area type="monotone" dataKey="Corpus" stroke="#2563eb" fill="#bfdbfe" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/retirement/__tests__/DrawdownChart.test.tsx`
Expected: PASS for both tests.

- [ ] **Step 5: Commit**

```bash
git add components/retirement/DrawdownChart.tsx components/retirement/__tests__/DrawdownChart.test.tsx
git commit -m "feat: render two-line safe/growth chart for bucket-strategy drawdown"
```

---

## Task 8: `DrawdownTable` — safe/growth columns for bucket rows

**Files:**
- Modify: `components/retirement/DrawdownTable.tsx`
- Create: `components/retirement/__tests__/DrawdownTable.test.tsx`

**Interfaces:**
- Consumes: `DrawdownRow`, `BucketDrawdownRow`, `isBucketDrawdown` (Tasks 2 and 4).
- Produces: no new exports — a leaf UI component.

- [ ] **Step 1: Write the failing test**

Create `components/retirement/__tests__/DrawdownTable.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DrawdownTable from "@/components/retirement/DrawdownTable";
import type { DrawdownRow, BucketDrawdownRow } from "@/lib/finance/retirement";

const flatRows: DrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000 },
];

const bucketRows: BucketDrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000, safeBalance: 2_000_000, growthBalance: 3_000_000 },
];

describe("DrawdownTable", () => {
  it("shows a single 'Corpus balance' column for plain DrawdownRow[]", () => {
    render(<DrawdownTable rows={flatRows} />);
    expect(screen.getByText("Corpus balance")).toBeInTheDocument();
    expect(screen.queryByText("Safe bucket")).not.toBeInTheDocument();
  });

  it("shows Safe bucket / Growth bucket / Total columns for BucketDrawdownRow[]", () => {
    render(<DrawdownTable rows={bucketRows} />);
    expect(screen.getByText("Safe bucket")).toBeInTheDocument();
    expect(screen.getByText("Growth bucket")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("₹20,00,000")).toBeInTheDocument();
    expect(screen.getByText("₹30,00,000")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/retirement/__tests__/DrawdownTable.test.tsx`
Expected: FAIL — `DrawdownTable` doesn't accept `BucketDrawdownRow[]` or render the extra columns yet.

- [ ] **Step 3: Extend the table**

Replace `components/retirement/DrawdownTable.tsx` with:

```tsx
"use client";
import { isBucketDrawdown, type DrawdownRow, type BucketDrawdownRow } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function DrawdownTable({ rows }: { rows: DrawdownRow[] | BucketDrawdownRow[] }) {
  if (isBucketDrawdown(rows)) {
    return (
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white">
            <tr className="text-left text-gray-500">
              <th>Age</th><th>Year</th><th>Expense (inflated)</th>
              <th>Safe bucket</th><th>Growth bucket</th><th>Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.age} className="border-t">
                <td>{r.age}</td>
                <td>{r.year}</td>
                <td>{formatINR(r.annualExpenseInflated)}</td>
                <td>{formatINR(r.safeBalance)}</td>
                <td>{formatINR(r.growthBalance)}</td>
                <td>{formatINR(r.corpusBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-gray-500">
            <th>Age</th><th>Year</th><th>Expense (inflated)</th><th>Corpus balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.age} className="border-t">
              <td>{r.age}</td>
              <td>{r.year}</td>
              <td>{formatINR(r.annualExpenseInflated)}</td>
              <td>{formatINR(r.corpusBalance)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/retirement/__tests__/DrawdownTable.test.tsx`
Expected: PASS for both tests.

- [ ] **Step 5: Commit**

```bash
git add components/retirement/DrawdownTable.tsx components/retirement/__tests__/DrawdownTable.test.tsx
git commit -m "feat: render safe/growth bucket columns in DrawdownTable"
```

---

## Task 9: Resources tab

**Files:**
- Create: `components/ResourcesTab.tsx`
- Create: `components/__tests__/ResourcesTab.test.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks — a fully static component.
- Produces: `ResourcesTab` default export, wired into `app/page.tsx` as the third tab.

- [ ] **Step 1: Write the failing test**

Create `components/__tests__/ResourcesTab.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResourcesTab from "@/components/ResourcesTab";

describe("ResourcesTab", () => {
  it("renders all three reference links with correct hrefs", () => {
    render(<ResourcesTab />);

    const zerodha = screen.getByRole("link", { name: /Retirement Corpus Generation \(Zerodha Varsity\)/ });
    expect(zerodha).toHaveAttribute("href", "https://zerodha.com/varsity/chapter/the-retirement-problem-part-2/");

    const wci = screen.getByRole("link", { name: /Retirement Bucket Strategy \(White Coat Investor\)/ });
    expect(wci).toHaveAttribute("href", "https://www.whitecoatinvestor.com/retirement-bucket-strategy/");

    const morningstar = screen.getByRole("link", { name: /Bucket Strategies Comparison \(Morningstar, PDF\)/ });
    expect(morningstar).toHaveAttribute(
      "href",
      "https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt2da7af775da0d57e/65aacbb9c7bb160246a29912/Bucket_Strategies_Comparison_(3)_(1).pdf",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run components/__tests__/ResourcesTab.test.tsx`
Expected: FAIL — `@/components/ResourcesTab` doesn't exist yet.

- [ ] **Step 3: Create the component**

Create `components/ResourcesTab.tsx`:

```tsx
const LINKS = [
  {
    href: "https://zerodha.com/varsity/chapter/the-retirement-problem-part-2/",
    title: "Retirement Corpus Generation (Zerodha Varsity)",
    note: "How to size a retirement corpus and the SIP needed to reach it.",
  },
  {
    href: "https://www.whitecoatinvestor.com/retirement-bucket-strategy/",
    title: "Retirement Bucket Strategy (White Coat Investor)",
    note: "The safe/growth bucket approach this app's drawdown mode is based on.",
  },
  {
    href: "https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt2da7af775da0d57e/65aacbb9c7bb160246a29912/Bucket_Strategies_Comparison_(3)_(1).pdf",
    title: "Bucket Strategies Comparison (Morningstar, PDF)",
    note: "Compares bucket-strategy variants side by side.",
  },
];

export default function ResourcesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Further reading</h2>
      <ul className="space-y-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
              {l.title}
            </a>
            <p className="text-sm text-gray-500">{l.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run components/__tests__/ResourcesTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire it in as the third app tab**

In `app/page.tsx`, replace:

```tsx
import Tabs from "@/components/Tabs";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import RetirementTab from "@/components/retirement/RetirementTab";
import BackupRestore from "@/components/BackupRestore";
```

with:

```tsx
import Tabs from "@/components/Tabs";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import RetirementTab from "@/components/retirement/RetirementTab";
import ResourcesTab from "@/components/ResourcesTab";
import BackupRestore from "@/components/BackupRestore";
```

and replace:

```tsx
      <Tabs tabs={["Investment Calculator", "Retirement Planner"]} active={active} onSelect={setActive} />
      {active === 0 ? (
        <CalculatorTab initial={handoff} />
      ) : (
        <RetirementTab
          onHandoff={(p) => {
            setHandoff({
              lumpsum: p.lumpsum,
              monthlySip: p.monthlySip,
              years: p.years,
              corpusGoal: p.corpusGoal,
              annualReturn: p.annualReturn,
              inflationPct: p.inflationPct,
            });
            setActive(0);
          }}
        />
      )}
```

with:

```tsx
      <Tabs tabs={["Investment Calculator", "Retirement Planner", "Resources"]} active={active} onSelect={setActive} />
      {active === 0 ? (
        <CalculatorTab initial={handoff} />
      ) : active === 1 ? (
        <RetirementTab
          onHandoff={(p) => {
            setHandoff({
              lumpsum: p.lumpsum,
              monthlySip: p.monthlySip,
              years: p.years,
              corpusGoal: p.corpusGoal,
              annualReturn: p.annualReturn,
              inflationPct: p.inflationPct,
            });
            setActive(0);
          }}
        />
      ) : (
        <ResourcesTab />
      )}
```

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: every test in the repo passes.

- [ ] **Step 7: Commit**

```bash
git add components/ResourcesTab.tsx components/__tests__/ResourcesTab.test.tsx app/page.tsx
git commit -m "feat: add Resources tab with bucket-strategy reference links"
```

---

## Task 10: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server and open the app**

Run: `npm run dev`

Open the app in a browser at the printed localhost URL.

- [ ] **Step 2: Verify the Retirement Planner tab, flat-rate mode (unchanged)**

- Click the "Retirement Planner" tab.
- Confirm the corpus/SIP result cards, the single-line "Corpus" chart, and the drawdown table (with just a "Corpus balance" column) all render as before — the "Use bucket strategy for drawdown" checkbox should be unchecked and the three bucket fields hidden.

- [ ] **Step 3: Verify bucket-strategy mode**

- Check "Use bucket strategy for drawdown". Confirm "Years of expense kept safe", "Safe bucket rate (%)", and "Growth bucket rate (%)" fields appear, pre-filled with 5 / 7 / 11.
- Confirm the chart switches to two lines with a legend ("Growth bucket", "Safe bucket").
- Confirm the drawdown table now shows "Safe bucket" / "Growth bucket" / "Total" columns, and the last row's Total is close to ₹0.
- Edit "Years of expense kept safe" to a different value (e.g. 3) and confirm the chart/table/result cards update.
- Uncheck the box again and confirm it reverts cleanly to the flat-rate view.

- [ ] **Step 4: Verify plan persistence**

- With bucket strategy checked, reload the page. Confirm the checkbox and field values are still checked/populated (not reset).

- [ ] **Step 5: Verify the Resources tab**

- Click the new "Resources" tab. Confirm the three links (Zerodha Varsity, White Coat Investor, Morningstar) render and open in a new tab when clicked.

- [ ] **Step 6: Report back**

Summarize what was checked and any visual issues found (e.g. layout overflow, color contrast) — do not report the feature complete until this manual pass is done.
