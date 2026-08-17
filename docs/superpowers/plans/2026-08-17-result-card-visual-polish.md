# Result Card Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Color-code signed result metrics (Gain/CAGR/XIRR in the Calculator tab, Shortfall/Surplus in the Retirement tab) green/red with a directional icon, and give all result cards more breathing room (larger radius, padding, shadow) — per `docs/superpowers/specs/2026-08-17-result-card-visual-polish-design.md`.

**Architecture:** Two sibling presentational components (`ResultCards.tsx`, `RetirementResults.tsx`) each build a local `cards: Card[]` array before rendering; add `signed`/`positive` fields to that array's type and branch the Tailwind classes per card on those fields. No new files besides tests, no changes to `lib/finance/*` — this is styling only, layered on values these components already compute.

**Tech Stack:** React 19 / Next.js (client components), Tailwind CSS 4 utility classes, Vitest + React Testing Library.

## Global Constraints

- Presentation-only: no changes to `lib/finance/*`, `formatINR`, or `formatPct`.
- Tinted backgrounds use the existing `bg-red-50`/`text-red-700` palette already used for the invalid-lifespan error card in `RetirementResults.tsx` — do not introduce a new red, and use `bg-green-50`/`text-green-700` as its positive counterpart.
- The value next to a directional icon is always `Math.abs(...)` of the underlying number, never the raw signed number — `formatINR`'s `toLocaleString` prepends a bare `-`, which would double up with the icon.
- The icon (`▲`/`▼`) is a separate `<span aria-hidden="true">`, never merged into the value's own text node — screen readers must still read the plain formatted value, and tests need an element boundary to query the icon and value independently.
- `AccumulationTable.tsx` is out of scope and must not be touched — its Surplus column can never be negative (see spec's Non-goals), so it gets no color treatment.
- No dark-mode classes — the app has no dark theme today (see spec's Non-goals).

---

### Task 1: Color-code and polish `ResultCards` (Calculator tab)

**Files:**
- Modify: `components/calculator/ResultCards.tsx`
- Test: `components/calculator/__tests__/ResultCards.test.tsx` (new file)

**Interfaces:**
- Consumes: `CalculatorResult` from `@/lib/finance/types` (`futureValue`, `totalInvested`, `gain`, `cagr`, `xirr`, `inflationAdjustedFV` — all `number`); `formatINR`, `formatPct` from `@/lib/finance/format`.
- Produces: no exported symbols change — `ResultCards` keeps its existing `{ result: CalculatorResult }` props signature. Later tasks don't depend on this one.

- [ ] **Step 1: Write the failing tests**

Create `components/calculator/__tests__/ResultCards.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ResultCards from "@/components/calculator/ResultCards";
import type { CalculatorResult } from "@/lib/finance/types";

const positiveResult: CalculatorResult = {
  futureValue: 8_542_000,
  totalInvested: 3_600_000,
  gain: 4_942_000,
  cagr: 0.142,
  xirr: 0.138,
  inflationAdjustedFV: 6_210_000,
};

const negativeResult: CalculatorResult = {
  futureValue: 900_000,
  totalInvested: 1_000_000,
  gain: -100_000,
  cagr: -0.02,
  xirr: -0.015,
  inflationAdjustedFV: 850_000,
};

function cardFor(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe("ResultCards", () => {
  it("renders a positive Gain card in green with an up icon", () => {
    render(<ResultCards result={positiveResult} />);
    const card = cardFor("Gain");
    expect(card.className).toContain("bg-green-50");
    expect(within(card).getByText("▲")).toBeInTheDocument();
    expect(within(card).getByText("₹49,42,000")).toBeInTheDocument();
  });

  it("renders a negative Gain card in red with a down icon and the absolute value (no leading minus)", () => {
    render(<ResultCards result={negativeResult} />);
    const card = cardFor("Gain");
    expect(card.className).toContain("bg-red-50");
    expect(within(card).getByText("▼")).toBeInTheDocument();
    expect(within(card).getByText("₹1,00,000")).toBeInTheDocument();
    expect(within(card).queryByText(/-₹/)).not.toBeInTheDocument();
  });

  it("colors CAGR and XIRR the same way as Gain", () => {
    render(<ResultCards result={negativeResult} />);
    expect(cardFor("CAGR").className).toContain("bg-red-50");
    expect(cardFor("XIRR").className).toContain("bg-red-50");
    expect(within(cardFor("CAGR")).getByText("2.00%")).toBeInTheDocument();
    expect(within(cardFor("XIRR")).getByText("1.50%")).toBeInTheDocument();
  });

  it("leaves neutral cards (Future Value, Total Invested, Inflation-adjusted FV) uncolored", () => {
    render(<ResultCards result={negativeResult} />);
    const card = cardFor("Future Value");
    expect(card.className).not.toContain("bg-green-50");
    expect(card.className).not.toContain("bg-red-50");
    expect(card.className).toContain("border");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/calculator/__tests__/ResultCards.test.tsx`
Expected: FAIL — `card.className` does not contain `"bg-green-50"`/`"bg-red-50"`, and `within(card).getByText("▲"/"▼")` finds nothing, because `ResultCards.tsx` doesn't render any of that yet.

- [ ] **Step 3: Implement the color-coding and spacing**

Replace the full contents of `components/calculator/ResultCards.tsx`:

```tsx
"use client";
import type { CalculatorResult } from "@/lib/finance/types";
import { formatINR, formatPct } from "@/lib/finance/format";

type Card = { label: string; value: string; signed?: boolean; positive?: boolean };

export default function ResultCards({ result }: { result: CalculatorResult }) {
  const cards: Card[] = [
    { label: "Future Value", value: formatINR(result.futureValue) },
    { label: "Total Invested", value: formatINR(result.totalInvested) },
    {
      label: "Gain",
      value: formatINR(Math.abs(result.gain)),
      signed: true,
      positive: result.gain >= 0,
    },
    {
      label: "CAGR",
      value: formatPct(Math.abs(result.cagr)),
      signed: true,
      positive: result.cagr >= 0,
    },
    {
      label: "XIRR",
      value: formatPct(Math.abs(result.xirr)),
      signed: true,
      positive: result.xirr >= 0,
    },
    { label: "Inflation-adjusted FV", value: formatINR(result.inflationAdjustedFV) },
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            c.signed
              ? `rounded-xl p-4 shadow-sm ${c.positive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`
              : "rounded-xl border p-4 shadow-sm"
          }
        >
          <div className={`text-xs uppercase ${c.signed ? "opacity-70" : "text-gray-500"}`}>
            {c.label}
          </div>
          <div className="text-lg font-semibold">
            {c.signed && (
              <span aria-hidden="true" className="mr-1">
                {c.positive ? "▲" : "▼"}
              </span>
            )}
            <span>{c.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/calculator/__tests__/ResultCards.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full existing suite to check for regressions**

Run: `npx vitest run components/calculator`
Expected: PASS — `CalculatorTab.test.tsx` renders `ResultCards` internally (e.g. `expect(screen.getAllByText(/₹/).length).toBeGreaterThan(0)` at `components/calculator/__tests__/CalculatorTab.test.tsx:17`); confirm that assertion and the others in that file still pass with the new markup.

- [ ] **Step 6: Commit**

```bash
git add components/calculator/ResultCards.tsx components/calculator/__tests__/ResultCards.test.tsx
git commit -m "feat: color-code Gain/CAGR/XIRR and polish ResultCards spacing"
```

---

### Task 2: Color-code and polish `RetirementResults` (Retirement tab)

**Files:**
- Modify: `components/retirement/RetirementResults.tsx`
- Test: `components/retirement/__tests__/RetirementResults.test.tsx` (new file)

**Interfaces:**
- Consumes: `RetirementResult` from `@/lib/finance/retirement` (`corpusNeededAtRetirement`, `corpusNeededToday`, `requiredMonthlySip`, `projectedCorpusFromCurrentPlan`, `gap`, `extraSipToCloseGap`, `drawdown: DrawdownRow[]` — all required); `formatINR` from `@/lib/finance/format`.
- Produces: no exported symbols change — `RetirementResults` keeps its existing `{ result: RetirementResult; invalidLifespan?: boolean }` props signature. Independent of Task 1 (different file, same pattern applied locally).

- [ ] **Step 1: Write the failing tests**

Create `components/retirement/__tests__/RetirementResults.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import RetirementResults from "@/components/retirement/RetirementResults";
import type { RetirementResult } from "@/lib/finance/retirement";

const shortfallResult: RetirementResult = {
  corpusNeededAtRetirement: 20_000_000,
  corpusNeededToday: 12_000_000,
  requiredMonthlySip: 50_000,
  projectedCorpusFromCurrentPlan: 18_180_000,
  gap: 1_820_000,
  extraSipToCloseGap: 5_000,
  drawdown: [],
};

const surplusResult: RetirementResult = {
  ...shortfallResult,
  projectedCorpusFromCurrentPlan: 21_820_000,
  gap: -1_820_000,
  extraSipToCloseGap: 0,
};

function cardFor(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe("RetirementResults", () => {
  it("shows a red Shortfall card with a down icon when gap is positive", () => {
    render(<RetirementResults result={shortfallResult} />);
    const card = cardFor("Shortfall");
    expect(card.className).toContain("bg-red-50");
    expect(within(card).getByText("▼")).toBeInTheDocument();
    expect(within(card).getByText("₹18,20,000")).toBeInTheDocument();
    expect(screen.queryByText("Surplus")).not.toBeInTheDocument();
  });

  it("shows a green Surplus card with an up icon when gap is negative", () => {
    render(<RetirementResults result={surplusResult} />);
    const card = cardFor("Surplus");
    expect(card.className).toContain("bg-green-50");
    expect(within(card).getByText("▲")).toBeInTheDocument();
    expect(within(card).getByText("₹18,20,000")).toBeInTheDocument();
    expect(screen.queryByText("Shortfall")).not.toBeInTheDocument();
  });

  it("leaves neutral cards uncolored", () => {
    render(<RetirementResults result={shortfallResult} />);
    const card = cardFor("Corpus needed (at retirement)");
    expect(card.className).not.toContain("bg-green-50");
    expect(card.className).not.toContain("bg-red-50");
    expect(card.className).toContain("border");
  });

  it("still shows the invalid-lifespan message, unaffected by the color-coding change", () => {
    render(<RetirementResults result={shortfallResult} invalidLifespan />);
    expect(screen.getByText(/lifespan must be greater/i)).toBeInTheDocument();
    expect(screen.queryByText("Shortfall")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run components/retirement/__tests__/RetirementResults.test.tsx`
Expected: FAIL — the Shortfall/Surplus card has no `bg-red-50`/`bg-green-50` class and no `▲`/`▼` icon yet; the other two tests (neutral card, invalid-lifespan message) should already pass since they don't depend on the new behavior — confirm only the color/icon assertions fail.

- [ ] **Step 3: Implement the color-coding and spacing**

Replace the full contents of `components/retirement/RetirementResults.tsx`:

```tsx
"use client";
import type { RetirementResult } from "@/lib/finance/retirement";
import { formatINR } from "@/lib/finance/format";

// requiredMonthlySip / extraSipToCloseGap can legitimately be Infinity (e.g.
// currentAge === retirementAge leaves no time for a SIP to accumulate — see
// lib/finance/retirement.ts). formatINR(Infinity) would render "₹∞", which
// reads as a broken number rather than an intentional "not achievable"
// result, so render it as text instead.
function formatMoneyOrInfinite(value: number): string {
  return Number.isFinite(value) ? formatINR(value) : "Not achievable in 0 years";
}

type Card = { label: string; value: string; signed?: boolean; positive?: boolean };

export default function RetirementResults({
  result, invalidLifespan,
}: { result: RetirementResult; invalidLifespan?: boolean }) {
  if (invalidLifespan) {
    return (
      <div className="rounded border border-red-400 bg-red-50 p-3 text-sm text-red-700">
        Lifespan must be greater than retirement age. The ₹0 corpus and SIP
        figures a plan like this would otherwise show are not real results —
        adjust the ages to see the actual numbers.
      </div>
    );
  }
  const cards: Card[] = [
    { label: "Corpus needed (at retirement)", value: formatINR(result.corpusNeededAtRetirement) },
    { label: "Corpus target (today's value)", value: formatINR(result.corpusNeededToday) },
    { label: "Required monthly SIP", value: formatMoneyOrInfinite(result.requiredMonthlySip) },
    { label: "Projected from current plan", value: formatINR(result.projectedCorpusFromCurrentPlan) },
    {
      label: result.gap >= 0 ? "Shortfall" : "Surplus",
      value: formatINR(Math.abs(result.gap)),
      signed: true,
      positive: result.gap < 0,
    },
    { label: "Extra SIP to close gap", value: formatMoneyOrInfinite(result.extraSipToCloseGap) },
  ];
  return (
    <div className="grid grid-cols-2 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            c.signed
              ? `rounded-xl p-4 shadow-sm ${c.positive ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`
              : "rounded-xl border p-4 shadow-sm"
          }
        >
          <div className={`text-xs uppercase ${c.signed ? "opacity-70" : "text-gray-500"}`}>
            {c.label}
          </div>
          <div className="text-lg font-semibold">
            {c.signed && (
              <span aria-hidden="true" className="mr-1">
                {c.positive ? "▲" : "▼"}
              </span>
            )}
            <span>{c.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run components/retirement/__tests__/RetirementResults.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full retirement test suite to check for regressions**

Run: `npx vitest run components/retirement`
Expected: PASS — `RetirementTab.test.tsx` renders `RetirementResults` internally; confirm nothing there (label text, handoff behavior, etc.) broke.

- [ ] **Step 6: Commit**

```bash
git add components/retirement/RetirementResults.tsx components/retirement/__tests__/RetirementResults.test.tsx
git commit -m "feat: color-code Shortfall/Surplus and polish RetirementResults spacing"
```

---

### Task 3: Full verification pass

**Files:** none (verification only, no code changes expected)

**Interfaces:** N/A

- [ ] **Step 1: Run the entire test suite**

Run: `npm test`
Expected: PASS — every test file in the repo, including the two new ones and every file that renders `ResultCards`/`RetirementResults` transitively (`CalculatorTab.test.tsx`, `RetirementTab.test.tsx`, `App.test.tsx`).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors. If any unused-import or formatting issues are flagged in `ResultCards.tsx` or `RetirementResults.tsx`, fix them and re-run.

- [ ] **Step 3: Manual visual check**

Run: `npm run dev`, open `http://localhost:3000`.
- Calculator tab: enter any lumpsum/SIP that produces a normal positive result — confirm Gain/CAGR/XIRR show a green tint with an up-arrow, and Future Value/Total Invested/Inflation-adjusted FV stay neutral with visible borders and the new rounded/padded/shadowed look.
- To see the red/negative path, set "Expected annual return" low enough (or negative, e.g. `-20`) that Gain goes negative — confirm the three cards switch to red with a down-arrow and no double minus sign in the value.
- Retirement tab: enter inputs where the current plan underfunds retirement — confirm a red "Shortfall" card; then increase "Current monthly investment" enough to overfund it — confirm it flips to a green "Surplus" card.
- Confirm no layout overflow/wrapping issues in the 2-column grid at a narrow (~375px) browser width.

- [ ] **Step 4: No commit needed for this task** unless Step 2 required fixes — if it did, commit those separately:

```bash
git add components/calculator/ResultCards.tsx components/retirement/RetirementResults.tsx
git commit -m "fix: address lint findings in result card polish"
```
