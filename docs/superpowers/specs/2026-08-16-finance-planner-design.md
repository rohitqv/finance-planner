# Finance Planner — Design Spec

**Date:** 2026-08-16
**Status:** Approved for planning

## Overview

A personal finance planning web app with two features sharing one calculation
engine:

1. **Investment Calculator** — forward projection. "I invest lumpsum X and SIP Y
   at rate r for Z years — what do I end up with?" Outputs future value, CAGR,
   XIRR, and inflation-adjusted value, with named saved scenarios for comparison.
2. **Retirement Planner** — backward, goal-driven. "I want to retire at a given
   age with a given lifestyle — how big a corpus do I need, and what must I
   invest monthly to get there?" Uses a corpus-depletion (drawdown) model with
   life-phase expenses.

The two features are separate focused tabs that share a pure finance-math core
and support a handoff: the Retirement Planner can push its computed required SIP,
current corpus, and corpus goal into the Investment Calculator as a scenario,
where the goal appears as a target line on the growth chart.

Deployed to Vercel as a client-side-only Next.js app (no backend, no database).

## Goals

- Project investment growth (lumpsum + SIP, with optional annual step-up).
- Report Future Value, Total Invested, Gain, CAGR, XIRR, and inflation-adjusted FV.
- Plan retirement using a corpus-depletion model with life-phase expenses.
- Solve for required monthly SIP and show the gap vs. the user's current plan.
- Compare multiple named scenarios and multiple retirement ages side by side.
- Persist scenarios locally (localStorage) with no login.
- Deploy cleanly to Vercel.

## Non-Goals (v1)

- No backend, database, authentication, or cross-device sync.
- No past-performance analysis (actual dated cash flows / real XIRR of a
  portfolio). Forward planning only.
- No personalized/licensed investment advice — this is a calculator.
- No tax modeling (LTCG, etc.), no SWP-specific tax logic.
- No multi-currency; default is INR (₹) with lakh/crore formatting.
- No export/import of scenarios (may come later).

## Tech Stack

- **Next.js (App Router) + TypeScript** — natural fit for Vercel, zero-config
  deploy.
- **Tailwind CSS** for styling.
- **Recharts** for growth / drawdown charts.
- Hand-written finance-math module (no heavy finance dependency).
- **localStorage** for scenario persistence (versioned key).
- Client-side only — no API routes required in v1.

## Architecture

```
lib/finance/          # pure functions, fully unit-tested, no React
  accumulation.ts     # FV & total invested for lumpsum + (step-up) SIP
  returns.ts          # CAGR, XIRR (Newton-Raphson)
  retirement.ts       # corpus depletion, required-SIP solver, phase expenses
  inflation.ts        # real-value (inflation-adjusted) helpers
  format.ts           # ₹ formatting, lakh/crore, percentages
  types.ts            # shared input/result types
components/           # InputPanel, ResultCards, GrowthChart, ScenarioTable,
                      # RetirementInputs, DrawdownTable, RetirementAgeCompare, ...
app/                  # Next.js App Router; tabbed layout (two tabs)
store/                # localStorage-backed scenario store (versioned)
```

The `lib/finance/` core is pure and unit-tested. UI components are a thin layer
that call the core and render results. Results are never persisted — only inputs
are stored; all metrics are recomputed from inputs so the engine is the single
source of truth.

## Feature 1: Investment Calculator

### Inputs (per scenario)

| Input | Symbol | Notes |
|---|---|---|
| Lumpsum invested today | X | May be 0 (pure SIP mode) |
| Monthly SIP amount | Y | May be 0 (pure lumpsum mode) |
| Annual SIP step-up | s% | Optional, default 0%; SIP rises by s% every 12 months |
| Expected annual return | r | Assumed growth rate |
| Duration | Z years | |
| Inflation rate | i% | Optional, default 0%; drives inflation-adjusted view |

### Calculation model

Build a month-by-month cash flow over `Z*12` months:

1. Month 0: invest `X` (if any).
2. Months 1..Z*12: invest the current SIP amount; the SIP starts at `Y` and
   increases by `s%` at the start of each new 12-month block.
3. Every invested amount compounds monthly at `r/12` until month `Z*12`.

### Outputs

| Metric | Meaning | Computation |
|---|---|---|
| Future Value (FV) | Total compounded value at end | Each cash flow compounded forward at `r/12` monthly |
| Total Invested | Capital actually put in | `X` + sum of all SIP installments |
| Gain | Profit | `FV - Total Invested` |
| CAGR | Blended annualized return on total capital | `(FV / Total Invested)^(1/Z) - 1` |
| XIRR | Money-weighted annual return | Newton-Raphson on dated cash flows (`X` and each SIP as outflows, `FV` as final inflow) |
| Inflation-adjusted FV | FV in today's purchasing power | `FV / (1+i)^Z`; shown only when `i > 0` |

### Correctness anchors (unit tests)

- **Pure lumpsum** (`Y=0`): `FV = X*(1+r)^Z`, and `CAGR = XIRR = r` exactly.
- **Pure SIP** (`X=0`): `XIRR ≈ r`; `CAGR` is lower than `r` (it treats capital
  as invested on average, ignoring timing) — assert the ordering and approximate
  values.
- **Step-up SIP**: total invested equals the summed geometric series of yearly
  SIP totals; FV monotonically increases with `s`.

### UI

- **Left:** input panel. `Y=0` → lumpsum mode; `X=0` → pure SIP mode (no special
  casing in math — falls out naturally).
- **Right:** result cards (FV, Total Invested, Gain, CAGR, XIRR, inflation-adjusted
  FV) + growth chart (invested vs. value over time). Optional **goal line** when a
  corpus target was handed over from the Retirement Planner.
- **Below:** scenario bar — saved named scenarios (e.g. Conservative / Aggressive)
  with a comparison table across all saved scenarios.

## Feature 2: Retirement Planner

### Inputs

| Input | Notes |
|---|---|
| Current age | |
| Retirement age | Retirement age − current age = accumulation window |
| Lifespan age | Retirement age → lifespan = drawdown window |
| Current monthly expense | In today's money |
| Inflation rate | Grows expenses every year, before and during retirement |
| Pre-retirement return | Rate investments earn while accumulating |
| Post-retirement return | Rate the corpus earns during drawdown (typically lower/safer) |
| Life-phase expenses | Optional overrides: phases with different monthly amounts in today's value (e.g. active 55–70 higher, slower 70–85 lower) |
| Current corpus | Existing savings already counted toward the goal |
| Current monthly investment | What the user invests today, for the gap check |

### Calculation model (corpus depletion / drawdown)

1. Inflate the current monthly expense to the **retirement year** → first
   retirement-year annual expense.
2. Walk each retirement year to lifespan, inflating the expense yearly and
   applying life-phase overrides where set (each phase amount is a today's-value
   figure that is itself inflated to the year it applies).
3. Discount that stream of yearly expenses back to the retirement date at the
   **post-retirement return** → **Corpus Needed at Retirement** (the corpus that
   funds all expenses and depletes to ~0 at lifespan).
4. Grow the **current corpus** forward at the **pre-retirement return** to its
   value at retirement.
5. **Required monthly SIP** = solve for the SIP that, added to the grown current
   corpus, reaches Corpus Needed by the retirement date (uses the shared
   accumulation engine; solved via the accumulation formula / bisection).
6. **Gap** = grow the user's **current monthly investment** to retirement and
   compare against the requirement → shortfall or surplus amount, plus the extra
   SIP needed to close it.

### Outputs

- **Corpus Needed** — in today's value and at-retirement value.
- **Required monthly SIP** to reach the corpus.
- **Gap vs. current plan** — short/surplus figure and extra SIP to close it.
- **Multiple retirement ages** — run steps 1–5 for e.g. retire @ 50 / 55 / 60 and
  show as side-by-side columns (mirrors the user's RET@50/@55/@60 spreadsheet).
- **Year-by-year table + chart** — depletion from retirement to lifespan (age,
  year, inflated expense, corpus balance drawing down). Scope decision made
  during implementation (2026-08-16): this table covers the depletion phase
  only, not the accumulation phase — the Investment Calculator tab's own
  growth chart already visualizes accumulation, and it's what the
  Retirement→Calculator handoff hands the user off to. Confirmed with the
  user rather than expanding this table to duplicate that view.

### Required vs. surplus accumulation view (added 2026-08-16)

When the user's current monthly investment exceeds the required monthly SIP,
they have a surplus worth visualizing. A new accumulation-phase chart + table
sits between the result cards and the existing depletion table, showing two
series from current age to retirement age:

- **Required** — `accumulate({lumpsum: currentCorpus, monthlySip:
  requiredMonthlySip, annualReturn: preReturnPct, years: accumYears})`'s yearly
  series. By construction (this is exactly how `requiredMonthlySip` is solved),
  this lands precisely on `corpusNeededAtRetirement` in the final year.
- **Surplus** — only shown when `currentMonthlyInvestment > requiredMonthlySip`.
  `accumulate({lumpsum: 0, monthlySip: currentMonthlyInvestment -
  requiredMonthlySip, annualReturn: preReturnPct, years: accumYears})`'s yearly
  series — the extra money growing on its own as bonus wealth beyond the goal.
- In the shortfall case (current investment ≤ required SIP), only the Required
  series/table is shown — the existing Gap/Extra-SIP cards already cover the
  shortfall.
- Guarded the same way as the Calculator handoff: omitted when
  `requiredMonthlySip` isn't finite or `retirementAge <= currentAge`.

This is a visualization split of existing numbers (current corpus, required
SIP, current monthly investment) — it introduces no new inputs and doesn't
change `computeRetirement`'s existing result fields.

### Correctness anchors (unit tests)

- A corpus equal to "Corpus Needed at Retirement," drawn down per the expense
  schedule at the post-retirement return, lands at ~0 (within tolerance) at
  lifespan.
- The Required series' final-year value equals `corpusNeededAtRetirement`
  (within floating-point tolerance).
- With `current corpus = 0`, the required-SIP solution fed back through the
  accumulation engine reproduces Corpus Needed at retirement.
- Zero inflation reduces expenses to a flat stream; corpus needed matches the
  present value of an ordinary annuity.

## Integration between the two features

- **Shared engine:** both features call the same `lib/finance/` core. No
  duplicated math.
- **Handoff:** a **"Plan this in Calculator"** action on the Retirement Planner
  creates a new scenario in the Investment Calculator pre-filled with the required
  SIP, the current corpus (as lumpsum X), and the years-to-retirement, plus the
  corpus goal.
- **Goal marker:** when a scenario carries a corpus goal, the Investment
  Calculator draws it as a target line on the growth chart so the user can see
  whether tweaks (step-up, higher return, etc.) still clear the goal.

## Data model & persistence

Scenarios are stored as a list under a single versioned localStorage key
(`finance-planner:scenarios:v1`).

```ts
type Scenario = {
  id: string;              // uuid
  name: string;            // "Conservative", "Aggressive", ...
  lumpsum: number;         // X
  monthlySip: number;      // Y
  stepUpPct: number;       // s
  annualReturn: number;    // r
  years: number;           // Z
  inflationPct: number;    // i
  corpusGoal?: number;     // optional target from Retirement Planner handoff
  createdAt: number;
};
```

- Only inputs are stored; all results are recomputed on load.
- The `v1` key suffix allows future migrations without breaking old data.
- CRUD: create, rename, edit, duplicate, delete. Duplicate is the fast path for
  "same but change one field."
- Retirement Planner inputs are similarly persisted under their own versioned key
  (`finance-planner:retirement:v1`), storing the latest plan (single plan in v1).

## Formatting

- Default currency INR (₹) with Indian lakh/crore grouping.
- Percentages and years rendered with sensible precision.
- All formatting centralized in `lib/finance/format.ts`.

## Testing

- `lib/finance/` has comprehensive unit tests, including the correctness anchors
  above (pure lumpsum, pure SIP, step-up, corpus depletion round-trips, zero
  inflation).
- Component-level smoke tests for the two tabs and the handoff are desirable but
  secondary to the math tests.

## Deployment

- Static/client-side Next.js app deployed to Vercel via its zero-config Next.js
  support. No environment variables or server runtime required for v1.

## Open questions / future

- Export/import scenarios as JSON.
- Past-performance (actual dated cash flow) XIRR.
- Optional multi-currency.
- Optional cross-device sync via a backend + database.
