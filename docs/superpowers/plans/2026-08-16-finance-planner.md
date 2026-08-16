# Finance Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side Next.js app with two tabs — an Investment Calculator (lumpsum + step-up SIP → FV/CAGR/XIRR/inflation-adjusted) and a Retirement Planner (corpus-depletion model → corpus needed + required SIP + gap) — sharing one pure, unit-tested finance-math core, deployable to Vercel.

**Architecture:** A pure TypeScript `lib/finance/` core (no React) holds all math and is fully unit-tested. React components in the Next.js App Router are a thin UI layer that calls the core. Scenarios persist in localStorage. The Retirement Planner hands off a computed plan to the Investment Calculator as a scenario with a corpus goal.

**Tech Stack:** Next.js (App Router) + TypeScript, Tailwind CSS, Recharts, Vitest for unit tests, deployed on Vercel.

## Global Constraints

- Currency: INR (₹) with Indian lakh/crore grouping; all formatting via `lib/finance/format.ts`.
- `lib/finance/` must be pure (no React, no browser globals) and fully unit-tested.
- Results are never persisted — only inputs are stored; all metrics recompute from inputs.
- localStorage keys are versioned: `finance-planner:scenarios:v1`, `finance-planner:retirement:v1`.
- Client-side only in v1 — no API routes, no server runtime, no env vars.
- Monthly return derived as the **effective** monthly rate `(1 + r/100)^(1/12) - 1` — NOT the nominal `r/12` — so that `r` is a true effective annual rate: a pure lumpsum's CAGR and XIRR reproduce `r` exactly, regardless of compounding frequency. (Corrected 2026-08-16 during Task 4: the original `r/12` nominal-rate draft contradicted this document's own correctness anchor, "pure lumpsum → CAGR = XIRR = r exactly" — see Task 3 for the resolution.) SIP contributions are month-end (ordinary annuity) unless a test states otherwise.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit.

---

## File Structure

```
lib/finance/
  types.ts            # shared input/result types
  format.ts           # ₹ lakh/crore, %, number formatting
  accumulation.ts     # FV & total invested for lumpsum + (step-up) SIP; monthly cashflow series
  returns.ts          # CAGR, XIRR (Newton-Raphson)
  inflation.ts        # inflation-adjusted (real-value) helpers
  retirement.ts       # corpus depletion, required-SIP solver, phase expenses, drawdown table
store/
  scenarios.ts        # localStorage-backed scenario CRUD (versioned)
  retirementPlan.ts   # localStorage-backed retirement plan persistence (versioned)
components/
  Tabs.tsx            # tab switcher shell
  calculator/
    InputPanel.tsx
    ResultCards.tsx
    GrowthChart.tsx
    ScenarioTable.tsx
    CalculatorTab.tsx
  retirement/
    RetirementInputs.tsx
    PhaseEditor.tsx
    RetirementResults.tsx
    DrawdownTable.tsx
    DrawdownChart.tsx
    RetirementAgeCompare.tsx
    RetirementTab.tsx
app/
  layout.tsx
  page.tsx            # hosts Tabs + both tab components
  globals.css
```

---

## Task 1: Project scaffold (Next.js + TS + Tailwind + Vitest)

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `vitest.config.ts`, `.gitignore`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- Test: `lib/finance/__tests__/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a runnable Next.js app (`npm run dev`), a passing test runner (`npm test`), Tailwind wired up.

- [ ] **Step 1: Create the Next.js app non-interactively**

Run:
```bash
npx --yes create-next-app@latest . --ts --tailwind --app --eslint --src-dir=false --import-alias "@/*" --no-turbopack --use-npm --yes
```
Expected: project files created in the current directory (answer any prompt with the flags above; if it refuses due to existing `docs/`, keep `docs/` — it does not conflict with generated files).

- [ ] **Step 2: Add Vitest + testing deps**

Run:
```bash
npm install --save-dev vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom
npm install recharts
```
Expected: dependencies installed, no errors.

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
```

- [ ] **Step 4: Add the `test` script to `package.json`**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test**

Create `lib/finance/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("runs the test runner", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

Run: `npm test`
Expected: PASS (1 test passed).

- [ ] **Step 7: Verify the app builds**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind and Vitest"
```

---

## Task 2: Finance types and formatting

**Files:**
- Create: `lib/finance/types.ts`, `lib/finance/format.ts`
- Test: `lib/finance/__tests__/format.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`:
    ```ts
    export type CalculatorInput = {
      lumpsum: number;      // X, >= 0
      monthlySip: number;   // Y, >= 0
      stepUpPct: number;    // s, annual %, >= 0
      annualReturn: number; // r, %
      years: number;        // Z, > 0 (whole years)
      inflationPct: number; // i, %, >= 0
    };
    export type CalculatorResult = {
      futureValue: number;
      totalInvested: number;
      gain: number;
      cagr: number;            // fraction, e.g. 0.12
      xirr: number;            // fraction
      inflationAdjustedFV: number;
    };
    export type MonthlyPoint = { month: number; invested: number; value: number };
    ```
  - `format.ts`: `formatINR(n: number): string`, `formatPct(fraction: number, dp?: number): string`, `formatNumber(n: number): string`.

- [ ] **Step 1: Write failing tests for formatting**

Create `lib/finance/__tests__/format.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { formatINR, formatPct } from "@/lib/finance/format";

describe("formatINR", () => {
  it("groups in the Indian system", () => {
    expect(formatINR(15200000)).toBe("₹1,52,00,000");
  });
  it("rounds to whole rupees", () => {
    expect(formatINR(1234.56)).toBe("₹1,235");
  });
});

describe("formatPct", () => {
  it("renders a fraction as a percent", () => {
    expect(formatPct(0.1234)).toBe("12.34%");
  });
  it("respects decimal places", () => {
    expect(formatPct(0.12, 0)).toBe("12%");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- format`
Expected: FAIL (module not found / functions undefined).

- [ ] **Step 3: Implement `types.ts`**

Create `lib/finance/types.ts` with the type block from Interfaces above.

- [ ] **Step 4: Implement `format.ts`**

```ts
export function formatINR(n: number): string {
  const rounded = Math.round(n);
  return "₹" + rounded.toLocaleString("en-IN");
}

export function formatPct(fraction: number, dp = 2): string {
  return (fraction * 100).toFixed(dp) + "%";
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString("en-IN");
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- format`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/finance/types.ts lib/finance/format.ts lib/finance/__tests__/format.test.ts
git commit -m "feat: add finance types and INR/percent formatting"
```

---

## Task 3: Accumulation engine (FV, total invested, monthly series)

**Files:**
- Create: `lib/finance/accumulation.ts`
- Test: `lib/finance/__tests__/accumulation.test.ts`

**Interfaces:**
- Consumes: `CalculatorInput`, `MonthlyPoint` from `types.ts`.
- Produces:
  - `buildCashflows(input: CalculatorInput): { month: number; amount: number }[]` — negative `amount` = outflow (investment). Month 0 = lumpsum; months 1..Z*12 = SIP with annual step-up.
  - `accumulate(input: CalculatorInput): { futureValue: number; totalInvested: number; series: MonthlyPoint[] }` — compounds every cashflow at the effective monthly rate `(1+r/100)^(1/12)-1` to month `Z*12`; `series` is one point per year end (invested-to-date vs. value-to-date).

- [ ] **Step 1: Write failing tests**

Create `lib/finance/__tests__/accumulation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { accumulate } from "@/lib/finance/accumulation";
import type { CalculatorInput } from "@/lib/finance/types";

const base: CalculatorInput = {
  lumpsum: 0, monthlySip: 0, stepUpPct: 0,
  annualReturn: 12, years: 10, inflationPct: 0,
};

describe("accumulate — pure lumpsum", () => {
  it("compounds a lumpsum at the effective monthly rate, reproducing the annual rate exactly after whole years", () => {
    const r = accumulate({ ...base, lumpsum: 1_000_000, monthlySip: 0, annualReturn: 12, years: 10 });
    // 1,000,000 * (1.12)^10 — effective annual compounding, independent of monthly conversion
    const expected = 1_000_000 * Math.pow(1.12, 10);
    expect(r.futureValue).toBeCloseTo(expected, 2);
    expect(r.totalInvested).toBe(1_000_000);
  });
});

describe("accumulate — pure SIP", () => {
  it("matches the ordinary-annuity FV formula using the effective monthly rate", () => {
    const P = 10_000, i = Math.pow(1.12, 1 / 12) - 1, n = 120;
    const r = accumulate({ ...base, lumpsum: 0, monthlySip: P, annualReturn: 12, years: 10 });
    const expected = P * ((Math.pow(1 + i, n) - 1) / i);
    expect(r.futureValue).toBeCloseTo(expected, 2);
    expect(r.totalInvested).toBe(P * n);
  });
});

describe("accumulate — step-up SIP", () => {
  it("increases total invested vs. flat SIP and raises FV", () => {
    const flat = accumulate({ ...base, monthlySip: 10_000, stepUpPct: 0 });
    const stepped = accumulate({ ...base, monthlySip: 10_000, stepUpPct: 10 });
    expect(stepped.totalInvested).toBeGreaterThan(flat.totalInvested);
    expect(stepped.futureValue).toBeGreaterThan(flat.futureValue);
  });
  it("computes total invested as the summed yearly geometric series", () => {
    // year k (0-indexed) monthly SIP = 10000 * 1.1^k, 12 months each, 10 years
    let expected = 0;
    for (let k = 0; k < 10; k++) expected += 10_000 * Math.pow(1.1, k) * 12;
    const r = accumulate({ ...base, monthlySip: 10_000, stepUpPct: 10 });
    expect(r.totalInvested).toBeCloseTo(expected, 2);
  });
});

describe("accumulate — series", () => {
  it("emits one point per year with non-decreasing value", () => {
    const r = accumulate({ ...base, lumpsum: 100_000, monthlySip: 5_000 });
    expect(r.series).toHaveLength(10);
    expect(r.series[9].value).toBeCloseTo(r.futureValue, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- accumulation`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `accumulation.ts`**

```ts
import type { CalculatorInput, MonthlyPoint } from "./types";

export function buildCashflows(input: CalculatorInput): { month: number; amount: number }[] {
  const flows: { month: number; amount: number }[] = [];
  const months = Math.round(input.years * 12);
  if (input.lumpsum > 0) flows.push({ month: 0, amount: -input.lumpsum });
  if (input.monthlySip > 0) {
    for (let m = 1; m <= months; m++) {
      const yearIndex = Math.floor((m - 1) / 12); // 0-based year
      const sip = input.monthlySip * Math.pow(1 + input.stepUpPct / 100, yearIndex);
      flows.push({ month: m, amount: -sip });
    }
  }
  return flows;
}

export function accumulate(input: CalculatorInput): {
  futureValue: number;
  totalInvested: number;
  series: MonthlyPoint[];
} {
  const months = Math.round(input.years * 12);
  const i = Math.pow(1 + input.annualReturn / 100, 1 / 12) - 1; // effective monthly rate
  const flows = buildCashflows(input);

  let totalInvested = 0;
  for (const f of flows) totalInvested += -f.amount;

  const futureValue = flows.reduce((acc, f) => {
    const grownMonths = months - f.month;
    return acc + -f.amount * Math.pow(1 + i, grownMonths);
  }, 0);

  // Yearly series: value and invested-to-date at each year end.
  const series: MonthlyPoint[] = [];
  for (let y = 1; y <= input.years; y++) {
    const atMonth = y * 12;
    let invested = 0;
    let value = 0;
    for (const f of flows) {
      if (f.month <= atMonth) {
        invested += -f.amount;
        value += -f.amount * Math.pow(1 + i, atMonth - f.month);
      }
    }
    series.push({ month: atMonth, invested, value });
  }

  return { futureValue, totalInvested, series };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- accumulation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/accumulation.ts lib/finance/__tests__/accumulation.test.ts
git commit -m "feat: add accumulation engine for lumpsum and step-up SIP"
```

---

## Task 4: Returns — CAGR and XIRR

**Files:**
- Create: `lib/finance/returns.ts`
- Test: `lib/finance/__tests__/returns.test.ts`

**Interfaces:**
- Consumes: `buildCashflows`, `accumulate` from `accumulation.ts`; `CalculatorInput` from `types.ts`.
- Produces:
  - `cagr(futureValue: number, totalInvested: number, years: number): number` — `(FV/TI)^(1/years) - 1`; returns 0 if `totalInvested <= 0`.
  - `xirrFromCashflows(flows: { month: number; amount: number }[], finalInflow: number, finalMonth: number): number` — annualized money-weighted rate via Newton-Raphson over monthly-dated flows (final inflow appended at `finalMonth`); returns the annual fraction.
  - `computeReturns(input: CalculatorInput): { cagr: number; xirr: number }`.

- [ ] **Step 1: Write failing tests**

Create `lib/finance/__tests__/returns.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cagr, computeReturns } from "@/lib/finance/returns";
import type { CalculatorInput } from "@/lib/finance/types";

const base: CalculatorInput = {
  lumpsum: 0, monthlySip: 0, stepUpPct: 0,
  annualReturn: 12, years: 10, inflationPct: 0,
};

describe("cagr", () => {
  it("computes annualized growth", () => {
    expect(cagr(2_000_000, 1_000_000, 10)).toBeCloseTo(Math.pow(2, 0.1) - 1, 6);
  });
  it("returns 0 when nothing was invested", () => {
    expect(cagr(0, 0, 10)).toBe(0);
  });
});

describe("computeReturns — pure lumpsum", () => {
  it("CAGR and XIRR both equal the input rate", () => {
    const r = computeReturns({ ...base, lumpsum: 1_000_000, monthlySip: 0 });
    expect(r.cagr).toBeCloseTo(0.12, 4);
    expect(r.xirr).toBeCloseTo(0.12, 4);
  });
});

describe("computeReturns — pure SIP", () => {
  it("XIRR is near the input rate; CAGR is below it", () => {
    const r = computeReturns({ ...base, monthlySip: 10_000, annualReturn: 12 });
    expect(r.xirr).toBeCloseTo(0.12, 2);
    expect(r.cagr).toBeLessThan(r.xirr);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- returns`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `returns.ts`**

```ts
import { buildCashflows, accumulate } from "./accumulation";
import type { CalculatorInput } from "./types";

export function cagr(futureValue: number, totalInvested: number, years: number): number {
  if (totalInvested <= 0 || years <= 0) return 0;
  return Math.pow(futureValue / totalInvested, 1 / years) - 1;
}

// Newton-Raphson on a monthly rate, then annualize.
export function xirrFromCashflows(
  flows: { month: number; amount: number }[],
  finalInflow: number,
  finalMonth: number,
): number {
  const all = [...flows, { month: finalMonth, amount: finalInflow }];
  const npv = (monthlyRate: number) =>
    all.reduce((s, f) => s + f.amount / Math.pow(1 + monthlyRate, f.month), 0);
  const dNpv = (monthlyRate: number) =>
    all.reduce((s, f) => s - (f.month * f.amount) / Math.pow(1 + monthlyRate, f.month + 1), 0);

  let rate = 0.01; // 1% monthly guess
  for (let iter = 0; iter < 100; iter++) {
    const value = npv(rate);
    const deriv = dNpv(rate);
    if (Math.abs(deriv) < 1e-12) break;
    const next = rate - value / deriv;
    if (!isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-10) { rate = next; break; }
    rate = next <= -0.9999 ? -0.9999 : next;
  }
  return Math.pow(1 + rate, 12) - 1;
}

export function computeReturns(input: CalculatorInput): { cagr: number; xirr: number } {
  const { futureValue, totalInvested } = accumulate(input);
  const flows = buildCashflows(input);
  const finalMonth = Math.round(input.years * 12);
  return {
    cagr: cagr(futureValue, totalInvested, input.years),
    xirr: xirrFromCashflows(flows, futureValue, finalMonth),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- returns`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/returns.ts lib/finance/__tests__/returns.test.ts
git commit -m "feat: add CAGR and XIRR (Newton-Raphson) computations"
```

---

## Task 5: Inflation adjustment and full calculator result

**Files:**
- Create: `lib/finance/inflation.ts`
- Modify: none
- Test: `lib/finance/__tests__/inflation.test.ts`, `lib/finance/__tests__/calculate.test.ts`
- Create: `lib/finance/calculate.ts`

**Interfaces:**
- Consumes: `accumulate`, `computeReturns`, `CalculatorInput`, `CalculatorResult`.
- Produces:
  - `inflation.ts`: `realValue(nominal: number, inflationPct: number, years: number): number` = `nominal / (1+i)^years`.
  - `calculate.ts`: `calculate(input: CalculatorInput): CalculatorResult` and `calculateSeries(input): MonthlyPoint[]` (re-exports `accumulate(...).series`).

- [ ] **Step 1: Write failing tests**

Create `lib/finance/__tests__/inflation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { realValue } from "@/lib/finance/inflation";

describe("realValue", () => {
  it("discounts nominal by inflation", () => {
    expect(realValue(1_000_000, 7, 10)).toBeCloseTo(1_000_000 / Math.pow(1.07, 10), 2);
  });
  it("is a no-op at zero inflation", () => {
    expect(realValue(500_000, 0, 20)).toBe(500_000);
  });
});
```

Create `lib/finance/__tests__/calculate.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { calculate } from "@/lib/finance/calculate";
import type { CalculatorInput } from "@/lib/finance/types";

const input: CalculatorInput = {
  lumpsum: 1_000_000, monthlySip: 10_000, stepUpPct: 10,
  annualReturn: 12, years: 15, inflationPct: 6,
};

describe("calculate", () => {
  it("returns a full, self-consistent result", () => {
    const r = calculate(input);
    expect(r.gain).toBeCloseTo(r.futureValue - r.totalInvested, 2);
    expect(r.inflationAdjustedFV).toBeLessThan(r.futureValue);
    expect(r.futureValue).toBeGreaterThan(r.totalInvested);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- inflation calculate`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `inflation.ts`**

```ts
export function realValue(nominal: number, inflationPct: number, years: number): number {
  return nominal / Math.pow(1 + inflationPct / 100, years);
}
```

- [ ] **Step 4: Implement `calculate.ts`**

```ts
import { accumulate } from "./accumulation";
import { computeReturns } from "./returns";
import { realValue } from "./inflation";
import type { CalculatorInput, CalculatorResult, MonthlyPoint } from "./types";

export function calculate(input: CalculatorInput): CalculatorResult {
  const { futureValue, totalInvested } = accumulate(input);
  const { cagr, xirr } = computeReturns(input);
  return {
    futureValue,
    totalInvested,
    gain: futureValue - totalInvested,
    cagr,
    xirr,
    inflationAdjustedFV: realValue(futureValue, input.inflationPct, input.years),
  };
}

export function calculateSeries(input: CalculatorInput): MonthlyPoint[] {
  return accumulate(input).series;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- inflation calculate`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/finance/inflation.ts lib/finance/calculate.ts lib/finance/__tests__/inflation.test.ts lib/finance/__tests__/calculate.test.ts
git commit -m "feat: add inflation adjustment and full calculator result"
```

---

## Task 6: Retirement engine — corpus depletion, required SIP, gap

**Files:**
- Create: `lib/finance/retirement.ts`
- Test: `lib/finance/__tests__/retirement.test.ts`

**Interfaces:**
- Consumes: `accumulate` from `accumulation.ts`.
- Produces (add these types to `retirement.ts`, exported):
  ```ts
  export type ExpensePhase = { fromAge: number; toAge: number; monthlyExpenseToday: number };
  export type RetirementInput = {
    currentAge: number;
    retirementAge: number;
    lifespanAge: number;
    currentMonthlyExpense: number;   // today's value; used where no phase covers a year
    inflationPct: number;
    preReturnPct: number;            // accumulation
    postReturnPct: number;           // drawdown
    phases: ExpensePhase[];          // optional overrides, may be empty
    currentCorpus: number;
    currentMonthlyInvestment: number;
  };
  export type DrawdownRow = {
    age: number; year: number; yearsFromNow: number;
    annualExpenseToday: number; annualExpenseInflated: number; corpusBalance: number;
  };
  export type RetirementResult = {
    corpusNeededAtRetirement: number;
    corpusNeededToday: number;
    requiredMonthlySip: number;
    projectedCorpusFromCurrentPlan: number; // current corpus + current SIP, grown to retirement
    gap: number;                            // required - projected (positive = shortfall)
    extraSipToCloseGap: number;
    drawdown: DrawdownRow[];
  };
  ```
  - `annualExpenseTodayForAge(input, age): number` — phase amount×12 if a phase covers `age`, else `currentMonthlyExpense`×12.
  - `computeRetirement(input: RetirementInput): RetirementResult`.
  - `requiredSip(target: number, years: number, annualReturnPct: number, currentCorpus: number): number` — solves the SIP (flat, month-end) that grows `currentCorpus` + SIP stream to `target` over `years`.

- [ ] **Step 1: Write failing tests**

Create `lib/finance/__tests__/retirement.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeRetirement, requiredSip, type RetirementInput } from "@/lib/finance/retirement";
import { accumulate } from "@/lib/finance/accumulation";

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50_000, inflationPct: 6,
  preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

describe("requiredSip", () => {
  it("solves a SIP that reaches the target with zero starting corpus", () => {
    const sip = requiredSip(10_000_000, 25, 12, 0);
    const fv = accumulate({
      lumpsum: 0, monthlySip: sip, stepUpPct: 0,
      annualReturn: 12, years: 25, inflationPct: 0,
    }).futureValue;
    expect(fv).toBeCloseTo(10_000_000, -1); // within ~10 rupees
  });
  it("reduces the required SIP when a starting corpus is present", () => {
    const none = requiredSip(10_000_000, 25, 12, 0);
    const some = requiredSip(10_000_000, 25, 12, 1_000_000);
    expect(some).toBeLessThan(none);
  });
});

describe("computeRetirement — corpus depletion round-trip", () => {
  it("a corpus equal to corpusNeededAtRetirement depletes to ~0 at lifespan", () => {
    const r = computeRetirement(base);
    // Re-simulate drawdown at postReturn using the reported inflated expenses.
    const i = base.postReturnPct / 100;
    let bal = r.corpusNeededAtRetirement;
    for (const row of r.drawdown) {
      bal = (bal - row.annualExpenseInflated) * (1 + i); // withdraw at year start, then grow
    }
    expect(Math.abs(bal)).toBeLessThan(r.corpusNeededAtRetirement * 0.001);
  });

  it("required SIP with zero current corpus reproduces the corpus at retirement", () => {
    const r = computeRetirement(base);
    const fv = accumulate({
      lumpsum: 0, monthlySip: r.requiredMonthlySip, stepUpPct: 0,
      annualReturn: base.preReturnPct, years: base.retirementAge - base.currentAge, inflationPct: 0,
    }).futureValue;
    expect(fv).toBeCloseTo(r.corpusNeededAtRetirement, -1);
  });

  it("gap is positive (shortfall) when current plan underfunds", () => {
    const r = computeRetirement({ ...base, currentMonthlyInvestment: 5_000 });
    expect(r.gap).toBeGreaterThan(0);
    expect(r.extraSipToCloseGap).toBeGreaterThan(0);
  });
});

describe("computeRetirement — phases", () => {
  it("lower late-life expense reduces the corpus needed", () => {
    const withPhase = computeRetirement({
      ...base,
      phases: [{ fromAge: 70, toAge: 85, monthlyExpenseToday: 30_000 }],
    });
    const withoutPhase = computeRetirement(base);
    expect(withPhase.corpusNeededAtRetirement).toBeLessThan(withoutPhase.corpusNeededAtRetirement);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- retirement`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `retirement.ts`**

```ts
import { accumulate } from "./accumulation";

export type ExpensePhase = { fromAge: number; toAge: number; monthlyExpenseToday: number };
export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  lifespanAge: number;
  currentMonthlyExpense: number;
  inflationPct: number;
  preReturnPct: number;
  postReturnPct: number;
  phases: ExpensePhase[];
  currentCorpus: number;
  currentMonthlyInvestment: number;
};
export type DrawdownRow = {
  age: number; year: number; yearsFromNow: number;
  annualExpenseToday: number; annualExpenseInflated: number; corpusBalance: number;
};
export type RetirementResult = {
  corpusNeededAtRetirement: number;
  corpusNeededToday: number;
  requiredMonthlySip: number;
  projectedCorpusFromCurrentPlan: number;
  gap: number;
  extraSipToCloseGap: number;
  drawdown: DrawdownRow[];
};

export function annualExpenseTodayForAge(input: RetirementInput, age: number): number {
  const phase = input.phases.find((p) => age >= p.fromAge && age <= p.toAge);
  const monthly = phase ? phase.monthlyExpenseToday : input.currentMonthlyExpense;
  return monthly * 12;
}

// Solve flat month-end SIP so that currentCorpus + SIP stream reaches target.
export function requiredSip(
  target: number, years: number, annualReturnPct: number, currentCorpus: number,
): number {
  const grownCorpus = accumulate({
    lumpsum: currentCorpus, monthlySip: 0, stepUpPct: 0,
    annualReturn: annualReturnPct, years, inflationPct: 0,
  }).futureValue;
  const remaining = target - grownCorpus;
  if (remaining <= 0) return 0;
  // FV of 1 unit monthly SIP over the horizon (linear in SIP), then scale.
  const fvPerUnit = accumulate({
    lumpsum: 0, monthlySip: 1, stepUpPct: 0,
    annualReturn: annualReturnPct, years, inflationPct: 0,
  }).futureValue;
  return remaining / fvPerUnit;
}

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

  const corpusNeededToday = corpusNeededAtRetirement / Math.pow(1 + infl, accumYears);
  const requiredMonthlySip = requiredSip(
    corpusNeededAtRetirement, accumYears, input.preReturnPct, input.currentCorpus,
  );

  const projectedCorpusFromCurrentPlan = accumulate({
    lumpsum: input.currentCorpus, monthlySip: input.currentMonthlyInvestment, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).futureValue;

  const gap = corpusNeededAtRetirement - projectedCorpusFromCurrentPlan;
  const extraSipToCloseGap = gap > 0
    ? requiredSip(corpusNeededAtRetirement, accumYears, input.preReturnPct,
        input.currentCorpus) - input.currentMonthlyInvestment
    : 0;

  return {
    corpusNeededAtRetirement,
    corpusNeededToday,
    requiredMonthlySip,
    projectedCorpusFromCurrentPlan,
    gap,
    extraSipToCloseGap: Math.max(0, extraSipToCloseGap),
    drawdown,
  };
}
```

Note: the round-trip test withdraws at year start then grows — the drawdown loop above matches that convention (withdraw, then grow), and `corpusNeededAtRetirement` is the PV of year-start withdrawals, so the balance lands at ~0 after the final year.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- retirement`
Expected: PASS. If the depletion round-trip is off by the last-year growth factor, align the test and the loop on the same convention (withdraw at start of year, then grow) — both are written that way here.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/retirement.ts lib/finance/__tests__/retirement.test.ts
git commit -m "feat: add retirement corpus-depletion engine and required-SIP solver"
```

---

## Task 7: Scenario store (localStorage)

**Files:**
- Create: `store/scenarios.ts`
- Test: `store/__tests__/scenarios.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Scenario = {
    id: string; name: string;
    lumpsum: number; monthlySip: number; stepUpPct: number;
    annualReturn: number; years: number; inflationPct: number;
    corpusGoal?: number; createdAt: number;
  };
  export function loadScenarios(): Scenario[];
  export function saveScenarios(list: Scenario[]): void;
  export function addScenario(partial: Omit<Scenario, "id" | "createdAt">): Scenario[];
  export function updateScenario(id: string, patch: Partial<Scenario>): Scenario[];
  export function deleteScenario(id: string): Scenario[];
  export function duplicateScenario(id: string): Scenario[];
  ```
- Key: `finance-planner:scenarios:v1`. Guards against SSR (`typeof window === "undefined"` → returns `[]` / no-op).

- [ ] **Step 1: Write failing tests**

Create `store/__tests__/scenarios.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { addScenario, loadScenarios, updateScenario, deleteScenario, duplicateScenario } from "@/store/scenarios";

beforeEach(() => localStorage.clear());

const draft = {
  name: "Base", lumpsum: 100000, monthlySip: 5000, stepUpPct: 0,
  annualReturn: 12, years: 10, inflationPct: 6,
};

describe("scenario store", () => {
  it("adds and loads scenarios", () => {
    const list = addScenario(draft);
    expect(list).toHaveLength(1);
    expect(loadScenarios()[0].name).toBe("Base");
    expect(loadScenarios()[0].id).toBeTruthy();
  });
  it("updates a scenario", () => {
    const [s] = addScenario(draft);
    const list = updateScenario(s.id, { name: "Renamed" });
    expect(list[0].name).toBe("Renamed");
  });
  it("duplicates a scenario with a new id", () => {
    const [s] = addScenario(draft);
    const list = duplicateScenario(s.id);
    expect(list).toHaveLength(2);
    expect(list[1].id).not.toBe(s.id);
  });
  it("deletes a scenario", () => {
    const [s] = addScenario(draft);
    expect(deleteScenario(s.id)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- scenarios`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `store/scenarios.ts`**

```ts
export type Scenario = {
  id: string; name: string;
  lumpsum: number; monthlySip: number; stepUpPct: number;
  annualReturn: number; years: number; inflationPct: number;
  corpusGoal?: number; createdAt: number;
};

const KEY = "finance-planner:scenarios:v1";
const canUse = () => typeof window !== "undefined" && !!window.localStorage;

export function loadScenarios(): Scenario[] {
  if (!canUse()) return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Scenario[]) : [];
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- scenarios`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add store/scenarios.ts store/__tests__/scenarios.test.ts
git commit -m "feat: add localStorage-backed scenario store"
```

---

## Task 8: Investment Calculator UI

**Files:**
- Create: `components/calculator/InputPanel.tsx`, `components/calculator/ResultCards.tsx`, `components/calculator/GrowthChart.tsx`, `components/calculator/ScenarioTable.tsx`, `components/calculator/CalculatorTab.tsx`
- Test: `components/calculator/__tests__/CalculatorTab.test.tsx`

**Interfaces:**
- Consumes: `calculate`, `calculateSeries` from `lib/finance/calculate.ts`; `formatINR`, `formatPct` from `lib/finance/format.ts`; scenario store from `store/scenarios.ts`; `CalculatorInput` from `types.ts`.
- Produces: `CalculatorTab` default export (a client component `"use client"`). `InputPanel` props: `{ value: CalculatorInput; onChange: (v: CalculatorInput) => void }`. `ResultCards` props: `{ result: CalculatorResult }`. `GrowthChart` props: `{ series: MonthlyPoint[]; goal?: number }`. `ScenarioTable` props: `{ scenarios: Scenario[]; onDelete; onDuplicate; onLoad }`.

- [ ] **Step 1: Write a failing component test**

Create `components/calculator/__tests__/CalculatorTab.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CalculatorTab from "@/components/calculator/CalculatorTab";

beforeEach(() => localStorage.clear());

describe("CalculatorTab", () => {
  it("shows a future value for a lumpsum", () => {
    render(<CalculatorTab />);
    const lumpsum = screen.getByLabelText(/lumpsum/i) as HTMLInputElement;
    fireEvent.change(lumpsum, { target: { value: "1000000" } });
    expect(screen.getByText(/future value/i)).toBeInTheDocument();
    // A ₹ amount is rendered somewhere in the results.
    expect(screen.getAllByText(/₹/).length).toBeGreaterThan(0);
  });

  it("saves a scenario", () => {
    render(<CalculatorTab />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Aggressive" } });
    fireEvent.click(screen.getByRole("button", { name: /save scenario/i }));
    expect(screen.getByText("Aggressive")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CalculatorTab`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `InputPanel.tsx`**

```tsx
"use client";
import type { CalculatorInput } from "@/lib/finance/types";

const fields: { key: keyof CalculatorInput; label: string; step?: number }[] = [
  { key: "lumpsum", label: "Lumpsum (₹)" },
  { key: "monthlySip", label: "Monthly SIP (₹)" },
  { key: "stepUpPct", label: "Annual SIP step-up (%)", step: 0.5 },
  { key: "annualReturn", label: "Expected annual return (%)", step: 0.5 },
  { key: "years", label: "Duration (years)" },
  { key: "inflationPct", label: "Inflation (%)", step: 0.5 },
];

export default function InputPanel({
  value, onChange,
}: { value: CalculatorInput; onChange: (v: CalculatorInput) => void }) {
  return (
    <div className="space-y-3">
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-sm text-gray-600">{f.label}</span>
          <input
            aria-label={f.label}
            type="number"
            step={f.step ?? 1}
            className="mt-1 w-full rounded border px-3 py-2"
            value={value[f.key]}
            onChange={(e) => onChange({ ...value, [f.key]: Number(e.target.value) })}
          />
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement `ResultCards.tsx`**

```tsx
"use client";
import type { CalculatorResult } from "@/lib/finance/types";
import { formatINR, formatPct } from "@/lib/finance/format";

export default function ResultCards({ result }: { result: CalculatorResult }) {
  const cards: { label: string; value: string }[] = [
    { label: "Future Value", value: formatINR(result.futureValue) },
    { label: "Total Invested", value: formatINR(result.totalInvested) },
    { label: "Gain", value: formatINR(result.gain) },
    { label: "CAGR", value: formatPct(result.cagr) },
    { label: "XIRR", value: formatPct(result.xirr) },
    { label: "Inflation-adjusted FV", value: formatINR(result.inflationAdjustedFV) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded border p-3">
          <div className="text-xs uppercase text-gray-500">{c.label}</div>
          <div className="text-lg font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement `GrowthChart.tsx`**

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import type { MonthlyPoint } from "@/lib/finance/types";

export default function GrowthChart({ series, goal }: { series: MonthlyPoint[]; goal?: number }) {
  const data = series.map((p) => ({ year: p.month / 12, Invested: Math.round(p.invested), Value: Math.round(p.value) }));
  return (
    <div style={{ width: "100%", height: 280 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="year" />
          <YAxis width={80} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Invested" stroke="#94a3b8" dot={false} />
          <Line type="monotone" dataKey="Value" stroke="#2563eb" dot={false} />
          {goal ? <ReferenceLine y={goal} stroke="#dc2626" strokeDasharray="4 4" label="Goal" /> : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: Implement `ScenarioTable.tsx`**

```tsx
"use client";
import type { Scenario } from "@/store/scenarios";
import { calculate } from "@/lib/finance/calculate";
import { formatINR, formatPct } from "@/lib/finance/format";

export default function ScenarioTable({
  scenarios, onDelete, onDuplicate, onLoad,
}: {
  scenarios: Scenario[];
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onLoad: (s: Scenario) => void;
}) {
  if (scenarios.length === 0) return <p className="text-sm text-gray-500">No saved scenarios yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          <th>Name</th><th>FV</th><th>CAGR</th><th>XIRR</th><th></th>
        </tr>
      </thead>
      <tbody>
        {scenarios.map((s) => {
          const r = calculate(s);
          return (
            <tr key={s.id} className="border-t">
              <td className="py-1">
                <button className="text-blue-600 underline" onClick={() => onLoad(s)}>{s.name}</button>
              </td>
              <td>{formatINR(r.futureValue)}</td>
              <td>{formatPct(r.cagr)}</td>
              <td>{formatPct(r.xirr)}</td>
              <td className="space-x-2 text-right">
                <button className="text-gray-600" onClick={() => onDuplicate(s.id)}>Duplicate</button>
                <button className="text-red-600" onClick={() => onDelete(s.id)}>Delete</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 7: Implement `CalculatorTab.tsx`**

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import InputPanel from "./InputPanel";
import ResultCards from "./ResultCards";
import GrowthChart from "./GrowthChart";
import ScenarioTable from "./ScenarioTable";
import { calculate, calculateSeries } from "@/lib/finance/calculate";
import type { CalculatorInput } from "@/lib/finance/types";
import {
  addScenario, deleteScenario, duplicateScenario, loadScenarios, type Scenario,
} from "@/store/scenarios";

const DEFAULT: CalculatorInput = {
  lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6,
};

export default function CalculatorTab({ initial }: { initial?: Partial<CalculatorInput> & { corpusGoal?: number } } = {}) {
  const [input, setInput] = useState<CalculatorInput>({ ...DEFAULT, ...initial });
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<number | undefined>(initial?.corpusGoal);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => setScenarios(loadScenarios()), []);
  useEffect(() => { if (initial) setInput({ ...DEFAULT, ...initial }); setGoal(initial?.corpusGoal); }, [initial]);

  const result = useMemo(() => calculate(input), [input]);
  const series = useMemo(() => calculateSeries(input), [input]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <InputPanel value={input} onChange={setInput} />
        <div className="mt-4 flex gap-2">
          <input
            aria-label="Scenario name"
            className="flex-1 rounded border px-3 py-2"
            placeholder="Scenario name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              if (!name.trim()) return;
              setScenarios(addScenario({ ...input, name: name.trim(), corpusGoal: goal }));
              setName("");
            }}
          >
            Save scenario
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <ResultCards result={result} />
        <GrowthChart series={series} goal={goal} />
      </div>
      <div className="md:col-span-2">
        <h3 className="mb-2 font-semibold">Saved scenarios</h3>
        <ScenarioTable
          scenarios={scenarios}
          onDelete={(id) => setScenarios(deleteScenario(id))}
          onDuplicate={(id) => setScenarios(duplicateScenario(id))}
          onLoad={(s) => { setInput(s); setGoal(s.corpusGoal); }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npm test -- CalculatorTab`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add components/calculator store/__tests__ 2>/dev/null; git add -A
git commit -m "feat: build Investment Calculator tab with scenarios and chart"
```

---

## Task 9: Retirement Planner UI

**Files:**
- Create: `components/retirement/RetirementInputs.tsx`, `components/retirement/PhaseEditor.tsx`, `components/retirement/RetirementResults.tsx`, `components/retirement/DrawdownTable.tsx`, `components/retirement/DrawdownChart.tsx`, `components/retirement/RetirementTab.tsx`
- Create: `store/retirementPlan.ts`
- Test: `components/retirement/__tests__/RetirementTab.test.tsx`, `store/__tests__/retirementPlan.test.ts`

**Interfaces:**
- Consumes: `computeRetirement`, `RetirementInput`, `RetirementResult` from `lib/finance/retirement.ts`; `formatINR` from `format.ts`.
- Produces:
  - `store/retirementPlan.ts`: `loadPlan(): RetirementInput | null`, `savePlan(p: RetirementInput): void`. Key `finance-planner:retirement:v1`, SSR-guarded.
  - `RetirementTab` default export (`"use client"`) accepting `{ onHandoff?: (payload: { monthlySip: number; lumpsum: number; years: number; corpusGoal: number }) => void }`.

- [ ] **Step 1: Write failing tests**

Create `store/__tests__/retirementPlan.test.ts`:
```ts
import { describe, it, expect, beforeEach } from "vitest";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import type { RetirementInput } from "@/lib/finance/retirement";

beforeEach(() => localStorage.clear());

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

describe("retirement plan store", () => {
  it("returns null when empty", () => {
    expect(loadPlan()).toBeNull();
  });
  it("round-trips a plan", () => {
    savePlan(plan);
    expect(loadPlan()?.retirementAge).toBe(55);
  });
});
```

Create `components/retirement/__tests__/RetirementTab.test.tsx`:
```tsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RetirementTab from "@/components/retirement/RetirementTab";

beforeEach(() => localStorage.clear());

describe("RetirementTab", () => {
  it("shows the corpus needed and a required SIP", () => {
    render(<RetirementTab />);
    expect(screen.getByText(/corpus needed/i)).toBeInTheDocument();
    expect(screen.getByText(/required monthly sip/i)).toBeInTheDocument();
    expect(screen.getAllByText(/₹/).length).toBeGreaterThan(0);
  });

  it("calls onHandoff with the required SIP and corpus goal", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    expect(onHandoff).toHaveBeenCalledTimes(1);
    const arg = onHandoff.mock.calls[0][0];
    expect(arg.corpusGoal).toBeGreaterThan(0);
    expect(arg.monthlySip).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- RetirementTab retirementPlan`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `store/retirementPlan.ts`**

```ts
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
```

- [ ] **Step 4: Implement `RetirementInputs.tsx`**

```tsx
"use client";
import type { RetirementInput } from "@/lib/finance/retirement";

const numFields: { key: keyof RetirementInput; label: string }[] = [
  { key: "currentAge", label: "Current age" },
  { key: "retirementAge", label: "Retirement age" },
  { key: "lifespanAge", label: "Lifespan age" },
  { key: "currentMonthlyExpense", label: "Current monthly expense (₹)" },
  { key: "inflationPct", label: "Inflation (%)" },
  { key: "preReturnPct", label: "Pre-retirement return (%)" },
  { key: "postReturnPct", label: "Post-retirement return (%)" },
  { key: "currentCorpus", label: "Current corpus (₹)" },
  { key: "currentMonthlyInvestment", label: "Current monthly investment (₹)" },
];

export default function RetirementInputs({
  value, onChange,
}: { value: RetirementInput; onChange: (v: RetirementInput) => void }) {
  return (
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
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Implement `PhaseEditor.tsx`**

```tsx
"use client";
import type { ExpensePhase } from "@/lib/finance/retirement";

export default function PhaseEditor({
  phases, onChange,
}: { phases: ExpensePhase[]; onChange: (p: ExpensePhase[]) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Life-phase expenses (optional)</span>
        <button
          className="text-sm text-blue-600"
          onClick={() => onChange([...phases, { fromAge: 70, toAge: 85, monthlyExpenseToday: 30000 }])}
        >
          + Add phase
        </button>
      </div>
      {phases.map((p, idx) => (
        <div key={idx} className="flex gap-2">
          {(["fromAge", "toAge", "monthlyExpenseToday"] as const).map((k) => (
            <input
              key={k}
              aria-label={`phase ${idx} ${k}`}
              type="number"
              className="w-full rounded border px-2 py-1 text-sm"
              value={p[k]}
              onChange={(e) => {
                const next = [...phases];
                next[idx] = { ...p, [k]: Number(e.target.value) };
                onChange(next);
              }}
            />
          ))}
          <button className="text-red-600" onClick={() => onChange(phases.filter((_, i) => i !== idx))}>×</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Implement `DrawdownTable.tsx`**

```tsx
"use client";
import type { DrawdownRow } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function DrawdownTable({ rows }: { rows: DrawdownRow[] }) {
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

- [ ] **Step 7: Implement `DrawdownChart.tsx`**

```tsx
"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DrawdownRow } from "@/lib/finance/retirement";

export default function DrawdownChart({ rows }: { rows: DrawdownRow[] }) {
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

- [ ] **Step 8: Implement `RetirementResults.tsx`**

```tsx
"use client";
import type { RetirementResult } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function RetirementResults({ result }: { result: RetirementResult }) {
  const cards = [
    { label: "Corpus needed (at retirement)", value: formatINR(result.corpusNeededAtRetirement) },
    { label: "Corpus needed (today's value)", value: formatINR(result.corpusNeededToday) },
    { label: "Required monthly SIP", value: formatINR(result.requiredMonthlySip) },
    { label: "Projected from current plan", value: formatINR(result.projectedCorpusFromCurrentPlan) },
    { label: result.gap >= 0 ? "Shortfall" : "Surplus", value: formatINR(Math.abs(result.gap)) },
    { label: "Extra SIP to close gap", value: formatINR(result.extraSipToCloseGap) },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded border p-3">
          <div className="text-xs uppercase text-gray-500">{c.label}</div>
          <div className="text-lg font-semibold">{c.value}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 9: Implement `RetirementTab.tsx`**

```tsx
"use client";
import { useEffect, useMemo, useState } from "react";
import RetirementInputs from "./RetirementInputs";
import PhaseEditor from "./PhaseEditor";
import RetirementResults from "./RetirementResults";
import DrawdownTable from "./DrawdownTable";
import DrawdownChart from "./DrawdownChart";
import { computeRetirement, type RetirementInput } from "@/lib/finance/retirement";
import { loadPlan, savePlan } from "@/store/retirementPlan";

const DEFAULT: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

export default function RetirementTab({
  onHandoff,
}: { onHandoff?: (p: { monthlySip: number; lumpsum: number; years: number; corpusGoal: number }) => void }) {
  const [input, setInput] = useState<RetirementInput>(DEFAULT);
  useEffect(() => { const p = loadPlan(); if (p) setInput(p); }, []);
  useEffect(() => { savePlan(input); }, [input]);

  const result = useMemo(() => computeRetirement(input), [input]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <RetirementInputs value={input} onChange={setInput} />
        <PhaseEditor phases={input.phases} onChange={(phases) => setInput({ ...input, phases })} />
      </div>
      <div className="space-y-4">
        <RetirementResults result={result} />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() =>
            onHandoff?.({
              monthlySip: Math.round(result.requiredMonthlySip),
              lumpsum: input.currentCorpus,
              years: input.retirementAge - input.currentAge,
              corpusGoal: Math.round(result.corpusNeededAtRetirement),
            })
          }
        >
          Plan this in Calculator
        </button>
        <DrawdownChart rows={result.drawdown} />
      </div>
      <div className="md:col-span-2">
        <h3 className="mb-2 font-semibold">Year-by-year drawdown</h3>
        <DrawdownTable rows={result.drawdown} />
      </div>
    </div>
  );
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm test -- RetirementTab retirementPlan`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: build Retirement Planner tab with drawdown table and handoff"
```

---

## Task 10: Multi-retirement-age comparison

**Files:**
- Create: `components/retirement/RetirementAgeCompare.tsx`
- Modify: `components/retirement/RetirementTab.tsx` (render the comparison below results)
- Test: `components/retirement/__tests__/RetirementAgeCompare.test.tsx`

**Interfaces:**
- Consumes: `computeRetirement`, `RetirementInput` from `lib/finance/retirement.ts`; `formatINR` from `format.ts`.
- Produces: `RetirementAgeCompare` (`"use client"`) props `{ base: RetirementInput; ages: number[] }` — for each retirement age it clones `base` with `retirementAge` overridden, runs `computeRetirement`, and renders a column with Corpus needed (at retirement), Required monthly SIP, and Corpus needed (today's value).

- [ ] **Step 1: Write a failing test**

Create `components/retirement/__tests__/RetirementAgeCompare.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RetirementAgeCompare from "@/components/retirement/RetirementAgeCompare";
import type { RetirementInput } from "@/lib/finance/retirement";

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

describe("RetirementAgeCompare", () => {
  it("renders a column per retirement age", () => {
    render(<RetirementAgeCompare base={base} ages={[50, 55, 60]} />);
    expect(screen.getByText(/Retire @ 50/)).toBeInTheDocument();
    expect(screen.getByText(/Retire @ 55/)).toBeInTheDocument();
    expect(screen.getByText(/Retire @ 60/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- RetirementAgeCompare`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `RetirementAgeCompare.tsx`**

```tsx
"use client";
import { computeRetirement, type RetirementInput } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

export default function RetirementAgeCompare({
  base, ages,
}: { base: RetirementInput; ages: number[] }) {
  const cols = ages.map((age) => ({ age, result: computeRetirement({ ...base, retirementAge: age }) }));
  const rows: { label: string; get: (r: ReturnType<typeof computeRetirement>) => number }[] = [
    { label: "Corpus needed (at retirement)", get: (r) => r.corpusNeededAtRetirement },
    { label: "Required monthly SIP", get: (r) => r.requiredMonthlySip },
    { label: "Corpus needed (today's value)", get: (r) => r.corpusNeededToday },
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-gray-500">
          <th></th>
          {cols.map((c) => <th key={c.age}>{`Retire @ ${c.age}`}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="border-t">
            <td className="py-1 text-gray-600">{row.label}</td>
            {cols.map((c) => <td key={c.age}>{formatINR(row.get(c.result))}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Render it in `RetirementTab.tsx`**

Add the import `import RetirementAgeCompare from "./RetirementAgeCompare";` and, inside the `md:col-span-2` block (above or below the drawdown table), add:
```tsx
<div className="mt-6">
  <h3 className="mb-2 font-semibold">Compare retirement ages</h3>
  <RetirementAgeCompare base={input} ages={[input.retirementAge - 5, input.retirementAge, input.retirementAge + 5]} />
</div>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- RetirementAgeCompare`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add multi-retirement-age comparison table"
```

---

## Task 11: Tab shell, page wiring, and handoff

**Files:**
- Create: `components/Tabs.tsx`
- Modify: `app/page.tsx`, `app/layout.tsx`
- Test: `components/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: `CalculatorTab`, `RetirementTab`.
- Produces: `app/page.tsx` renders a two-tab UI; clicking "Plan this in Calculator" in the Retirement tab switches to the Calculator tab and pre-fills the handoff payload.

- [ ] **Step 1: Write a failing integration test**

Create `components/__tests__/App.test.tsx`:
```tsx
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Page from "@/app/page";

beforeEach(() => localStorage.clear());

describe("App handoff", () => {
  it("moves from Retirement to Calculator with a prefilled SIP and goal line", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /retirement planner/i }));
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    // Now on the calculator tab; a goal reference line label "Goal" is present.
    expect(screen.getByLabelText(/monthly sip/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- App`
Expected: FAIL (page has no tabs yet).

- [ ] **Step 3: Implement `components/Tabs.tsx`**

```tsx
"use client";
export default function Tabs({
  tabs, active, onSelect,
}: { tabs: string[]; active: number; onSelect: (i: number) => void }) {
  return (
    <div className="mb-6 flex gap-2 border-b">
      {tabs.map((t, i) => (
        <button
          key={t}
          className={`px-4 py-2 ${i === active ? "border-b-2 border-blue-600 font-semibold" : "text-gray-500"}`}
          onClick={() => onSelect(i)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Implement `app/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import Tabs from "@/components/Tabs";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import RetirementTab from "@/components/retirement/RetirementTab";
import type { CalculatorInput } from "@/lib/finance/types";

export default function Page() {
  const [active, setActive] = useState(0);
  const [handoff, setHandoff] = useState<(Partial<CalculatorInput> & { corpusGoal?: number }) | undefined>();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Finance Planner</h1>
      <Tabs tabs={["Investment Calculator", "Retirement Planner"]} active={active} onSelect={setActive} />
      {active === 0 ? (
        <CalculatorTab initial={handoff} />
      ) : (
        <RetirementTab
          onHandoff={(p) => {
            setHandoff({ lumpsum: p.lumpsum, monthlySip: p.monthlySip, years: p.years, corpusGoal: p.corpusGoal });
            setActive(0);
          }}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 5: Set the page metadata title in `app/layout.tsx`**

Ensure `metadata` exports `title: "Finance Planner"` (edit the generated `metadata` object). Keep the rest of the generated layout.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- App`
Expected: PASS.

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build`
Expected: all tests PASS; build succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: wire two-tab app shell with retirement-to-calculator handoff"
```

---

## Task 12: Vercel deployment config and README

**Files:**
- Create: `vercel.json` (optional — only if needed), `README.md`

**Interfaces:**
- Produces: deployable app; documented deploy steps.

- [ ] **Step 1: Write `README.md`**

Include: what the app does, `npm install`, `npm run dev`, `npm test`, `npm run build`, and Vercel deploy instructions (import the git repo in Vercel; framework auto-detected as Next.js; no env vars needed).

- [ ] **Step 2: Verify a production build**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: (Optional) Deploy preview**

Run:
```bash
npx --yes vercel@latest --version
```
Expected: prints a version (confirms the CLI is available). Actual deploy (`vercel`) is a manual step the user runs when ready, or via the Vercel dashboard by importing the repo.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: add README and Vercel deployment notes"
```

---

## Self-Review Notes

- **Spec coverage:** Investment Calculator (Tasks 2–5, 8), Retirement Planner corpus-depletion + required SIP + gap + phases + drawdown (Task 6, 9), multi-retirement-age comparison (Task 10), shared engine (all math in `lib/finance/`), handoff + goal marker (Tasks 8, 9, 11), localStorage persistence with versioned keys (Tasks 7, 9), INR formatting (Task 2), Vercel deploy (Task 12). Correctness anchors from the spec are encoded as tests in Tasks 3, 4, 6.
- **Placeholders:** none — every code step contains full code.
- **Type consistency:** `CalculatorInput`/`CalculatorResult`/`MonthlyPoint` defined in Task 2 and used consistently; `RetirementInput`/`RetirementResult`/`DrawdownRow`/`ExpensePhase` defined in Task 6 and consumed unchanged in Task 9; `Scenario` defined in Task 7 and used in Tasks 8/10.
