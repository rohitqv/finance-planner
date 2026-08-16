# Required-vs-Surplus Accumulation View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the Retirement Planner tab, show a chart + table of how the required-SIP money and any surplus-SIP money each grow from now to retirement age, landing the Required series exactly on the corpus target.

**Architecture:** A new pure function in `lib/finance/retirement.ts` splits accumulation into two series by re-using the existing `accumulate()` engine (no new math, no new inputs). Two new presentational components render it, wired into the existing `RetirementTab.tsx` between the result cards and the depletion table.

**Tech Stack:** Same as the rest of the app — TypeScript, Recharts, Vitest, React Testing Library.

## Global Constraints

- `lib/finance/` stays pure (no React, no browser globals) and fully unit-tested.
- Reuse `accumulate()` from `lib/finance/accumulation.ts` — no hand-rolled compounding.
- Guarded the same way as the existing Calculator handoff: omit when `requiredMonthlySip` isn't finite or `retirementAge <= currentAge` (return empty series rather than crash).
- Currency formatting via `formatINR` from `lib/finance/format.ts`.
- TDD: write the failing test first, watch it fail, implement minimally, watch it pass, commit.

---

## File Structure

```
lib/finance/
  retirement.ts        # + computeAccumulationSplit, AccumulationSplitResult
components/retirement/
  AccumulationChart.tsx # new
  AccumulationTable.tsx # new
  RetirementTab.tsx     # modified: renders the new section
```

---

## Task 1: `computeAccumulationSplit` in the finance core

**Files:**
- Modify: `lib/finance/retirement.ts`
- Test: `lib/finance/__tests__/retirement.test.ts`

**Interfaces:**
- Consumes: `accumulate` from `./accumulation`; `RetirementInput` (existing type in this file); `MonthlyPoint` from `./types`.
- Produces:
  ```ts
  export type AccumulationSplitResult = {
    required: MonthlyPoint[];
    surplus: MonthlyPoint[] | null;
  };
  export function computeAccumulationSplit(
    input: RetirementInput, requiredMonthlySip: number,
  ): AccumulationSplitResult;
  ```
  `requiredMonthlySip` is passed in by the caller (already computed by `computeRetirement(input).requiredMonthlySip`) rather than recomputed here — keeps this function simple, testable in isolation, and avoids re-running the depletion pass just to get one number.

- [ ] **Step 1: Write failing tests**

Add to `lib/finance/__tests__/retirement.test.ts`:
```ts
import { computeAccumulationSplit } from "@/lib/finance/retirement";

describe("computeAccumulationSplit", () => {
  it("the Required series lands on the corpus target in its final year", () => {
    const r = computeRetirement(base);
    const split = computeAccumulationSplit(base, r.requiredMonthlySip);
    const accumYears = base.retirementAge - base.currentAge;
    expect(split.required).toHaveLength(accumYears);
    expect(split.required[accumYears - 1].value).toBeCloseTo(r.corpusNeededAtRetirement, -1);
  });

  it("returns null surplus when there is no surplus", () => {
    const split = computeAccumulationSplit(
      { ...base, currentMonthlyInvestment: 0 }, 50_000,
    );
    expect(split.surplus).toBeNull();
  });

  it("returns a surplus series sized to the excess over the required SIP", () => {
    const requiredSipAmount = 50_000;
    const split = computeAccumulationSplit(
      { ...base, currentMonthlyInvestment: 80_000 }, requiredSipAmount,
    );
    expect(split.surplus).not.toBeNull();
    const accumYears = base.retirementAge - base.currentAge;
    const expectedSurplusFv = accumulate({
      lumpsum: 0, monthlySip: 30_000, stepUpPct: 0,
      annualReturn: base.preReturnPct, years: accumYears, inflationPct: 0,
    }).futureValue;
    expect(split.surplus![accumYears - 1].value).toBeCloseTo(expectedSurplusFv, -1);
  });

  it("returns empty series when there are zero or negative years to retirement", () => {
    const split = computeAccumulationSplit(
      { ...base, retirementAge: base.currentAge }, 50_000,
    );
    expect(split.required).toEqual([]);
    expect(split.surplus).toBeNull();
  });

  it("returns empty series when requiredMonthlySip is not finite", () => {
    const split = computeAccumulationSplit(base, Infinity);
    expect(split.required).toEqual([]);
    expect(split.surplus).toBeNull();
  });
});
```

Note: `accumulate` must already be imported in the test file (it already is, from the existing `requiredSip` tests) — if not, add `import { accumulate } from "@/lib/finance/accumulation";` at the top.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- retirement`
Expected: FAIL (`computeAccumulationSplit` is not exported / not defined).

- [ ] **Step 3: Implement `computeAccumulationSplit`**

Add to `lib/finance/retirement.ts` (after `computeRetirement`, or anywhere below the existing exports — do not reorder existing code):

```ts
import type { MonthlyPoint } from "./types";

export type AccumulationSplitResult = {
  required: MonthlyPoint[];
  surplus: MonthlyPoint[] | null;
};

export function computeAccumulationSplit(
  input: RetirementInput, requiredMonthlySip: number,
): AccumulationSplitResult {
  const accumYears = input.retirementAge - input.currentAge;
  if (accumYears <= 0 || !Number.isFinite(requiredMonthlySip)) {
    return { required: [], surplus: null };
  }

  const required = accumulate({
    lumpsum: input.currentCorpus, monthlySip: requiredMonthlySip, stepUpPct: 0,
    annualReturn: input.preReturnPct, years: accumYears, inflationPct: 0,
  }).series;

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

Add `import type { MonthlyPoint } from "./types";` to the top of the file alongside the existing `import { accumulate } from "./accumulation";` line (don't duplicate the import if the file already imports from `./types` elsewhere — check first).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- retirement`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/finance/retirement.ts lib/finance/__tests__/retirement.test.ts
git commit -m "feat: add required-vs-surplus accumulation split to retirement engine"
```

---

## Task 2: Accumulation chart + table, wired into the Retirement tab

**Files:**
- Create: `components/retirement/AccumulationChart.tsx`
- Create: `components/retirement/AccumulationTable.tsx`
- Modify: `components/retirement/RetirementTab.tsx`
- Test: `components/retirement/__tests__/AccumulationChart.test.tsx`, `components/retirement/__tests__/AccumulationTable.test.tsx`

**Interfaces:**
- Consumes: `computeAccumulationSplit`, `AccumulationSplitResult` from `lib/finance/retirement.ts`; `MonthlyPoint` from `lib/finance/types.ts`; `formatINR` from `lib/finance/format.ts`.
- Produces: `AccumulationChart` props `{ required: MonthlyPoint[]; surplus: MonthlyPoint[] | null; startAge: number }`. `AccumulationTable` props `{ required: MonthlyPoint[]; surplus: MonthlyPoint[] | null; startAge: number }`.

- [ ] **Step 1: Write failing tests**

Create `components/retirement/__tests__/AccumulationTable.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AccumulationTable from "@/components/retirement/AccumulationTable";
import type { MonthlyPoint } from "@/lib/finance/types";

const required: MonthlyPoint[] = [
  { month: 12, invested: 600_000, value: 650_000 },
  { month: 24, invested: 1_200_000, value: 1_380_000 },
];

describe("AccumulationTable", () => {
  it("shows only Required when there is no surplus", () => {
    render(<AccumulationTable required={required} surplus={null} startAge={30} />);
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.queryByText(/surplus/i)).not.toBeInTheDocument();
  });

  it("shows Required, Surplus, and Total columns when there is a surplus", () => {
    const surplus: MonthlyPoint[] = [
      { month: 12, invested: 200_000, value: 210_000 },
      { month: 24, invested: 400_000, value: 440_000 },
    ];
    render(<AccumulationTable required={required} surplus={surplus} startAge={30} />);
    expect(screen.getByText(/surplus/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
  });

  it("renders nothing (no rows) for an empty series", () => {
    render(<AccumulationTable required={[]} surplus={null} startAge={30} />);
    expect(screen.queryByRole("row", { name: /31/ })).not.toBeInTheDocument();
  });
});
```

Create `components/retirement/__tests__/AccumulationChart.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AccumulationChart from "@/components/retirement/AccumulationChart";
import type { MonthlyPoint } from "@/lib/finance/types";

const required: MonthlyPoint[] = [
  { month: 12, invested: 600_000, value: 650_000 },
];

describe("AccumulationChart", () => {
  it("renders without crashing when surplus is null", () => {
    const { container } = render(<AccumulationChart required={required} surplus={null} startAge={30} />);
    expect(container.querySelector("svg, .recharts-wrapper")).toBeTruthy();
  });

  it("renders without crashing when surplus is present", () => {
    const surplus: MonthlyPoint[] = [{ month: 12, invested: 200_000, value: 210_000 }];
    const { container } = render(<AccumulationChart required={required} surplus={surplus} startAge={30} />);
    expect(container.querySelector("svg, .recharts-wrapper")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- AccumulationTable AccumulationChart`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `AccumulationTable.tsx`**

```tsx
"use client";
import type { MonthlyPoint } from "@/lib/finance/types";
import { formatINR } from "@/lib/finance/format";

export default function AccumulationTable({
  required, surplus, startAge,
}: { required: MonthlyPoint[]; surplus: MonthlyPoint[] | null; startAge: number }) {
  if (required.length === 0) return null;
  const nowYear = new Date().getFullYear();

  return (
    <div className="max-h-80 overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-white">
          <tr className="text-left text-gray-500">
            <th>Age</th><th>Year</th><th>Required</th>
            {surplus ? <th>Surplus</th> : null}
            {surplus ? <th>Total</th> : null}
          </tr>
        </thead>
        <tbody>
          {required.map((r, i) => {
            const age = startAge + i + 1;
            const surplusValue = surplus ? surplus[i].value : 0;
            return (
              <tr key={age} className="border-t">
                <td>{age}</td>
                <td>{nowYear + i + 1}</td>
                <td>{formatINR(r.value)}</td>
                {surplus ? <td>{formatINR(surplusValue)}</td> : null}
                {surplus ? <td>{formatINR(r.value + surplusValue)}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implement `AccumulationChart.tsx`**

```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { MonthlyPoint } from "@/lib/finance/types";

export default function AccumulationChart({
  required, surplus, startAge,
}: { required: MonthlyPoint[]; surplus: MonthlyPoint[] | null; startAge: number }) {
  const data = required.map((r, i) => ({
    age: startAge + i + 1,
    Required: Math.round(r.value),
    ...(surplus ? { Surplus: Math.round(surplus[i].value) } : {}),
  }));
  return (
    <div style={{ width: "100%", height: 240 }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey="age" />
          <YAxis width={80} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="Required" stroke="#2563eb" dot={false} />
          {surplus ? <Line type="monotone" dataKey="Surplus" stroke="#16a34a" dot={false} /> : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- AccumulationTable AccumulationChart`
Expected: PASS.

- [ ] **Step 6: Wire into `RetirementTab.tsx`**

In `components/retirement/RetirementTab.tsx`:
1. Add imports: `import AccumulationChart from "./AccumulationChart";`, `import AccumulationTable from "./AccumulationTable";`, and `computeAccumulationSplit` alongside the existing `computeRetirement` import from `@/lib/finance/retirement`.
2. After `const result = useMemo(() => computeRetirement(input), [input]);`, add:
   ```ts
   const split = useMemo(
     () => computeAccumulationSplit(input, result.requiredMonthlySip),
     [input, result.requiredMonthlySip],
   );
   ```
3. Inside the `md:col-span-2` div, insert a new section BEFORE the existing `<h3>Year-by-year drawdown</h3>` block:
   ```tsx
   {split.required.length > 0 ? (
     <div className="mb-6">
       <h3 className="mb-2 font-semibold">
         Growing to retirement{split.surplus ? " — required vs. surplus" : ""}
       </h3>
       <AccumulationChart required={split.required} surplus={split.surplus} startAge={input.currentAge} />
       <AccumulationTable required={split.required} surplus={split.surplus} startAge={input.currentAge} />
     </div>
   ) : null}
   ```

Do not restructure any other part of the file — this is an additive insertion only.

- [ ] **Step 7: Run the full suite and build**

Run: `npm test && npm run build && npm run lint`
Expected: all tests PASS; build succeeds; lint clean.

- [ ] **Step 8: Commit**

```bash
git add components/retirement/AccumulationChart.tsx components/retirement/AccumulationTable.tsx components/retirement/RetirementTab.tsx components/retirement/__tests__/AccumulationChart.test.tsx components/retirement/__tests__/AccumulationTable.test.tsx
git commit -m "feat: show required-vs-surplus accumulation chart and table on Retirement tab"
```

---

## Self-Review Notes

- **Spec coverage:** the new "Required vs. surplus accumulation view" spec section is covered by Task 1 (the split function + its correctness anchor: Required series lands on `corpusNeededAtRetirement`) and Task 2 (chart + table, shortfall case shows Required only, guarded for non-finite/zero-year cases, placed between results and the depletion table).
- **Placeholders:** none — every code step has full code.
- **Type consistency:** `AccumulationSplitResult`, `computeAccumulationSplit` defined in Task 1 and consumed unchanged in Task 2; both new components reuse the existing `MonthlyPoint` type rather than inventing a new one.
