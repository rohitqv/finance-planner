# Asset-class corpus split (Mutual Fund / Gold / EPFO / Real Estate)

## Goal

Replace the single "Current corpus" number on the Retirement tab with four
fixed asset-class buckets — Mutual Fund, Gold, EPFO, Real Estate — each with
its own current amount, its own expected annual growth rate, and a checkbox
for whether it counts toward the retirement corpus calculation. This lets a
user model EPFO (and other assets) growing at a realistic rate distinct from
the rate used for fresh SIP investments, and exclude illiquid or
out-of-scope assets (e.g. real estate) from the retirement math without
deleting the data.

## Non-goals

- No dynamic/custom asset classes — the set of four is fixed.
- No per-asset-class monthly contribution. Monthly investment stays a single
  blended number, growing at `preReturnPct`, same as today.
- No backend/database persistence change. Storage stays `localStorage`,
  same as the rest of the app.

## Data model

`lib/finance/retirement.ts`:

```ts
export type AssetClassKey = "mutualFund" | "gold" | "epfo" | "realEstate";

export type AssetClass = {
  key: AssetClassKey;
  label: string;               // "Mutual Fund" | "Gold" | "EPFO" | "Real Estate"
  amount: number;               // current value, ₹, >= 0
  ratePct: number;              // expected annual growth %
  includeInRetirement: boolean; // counts toward retirement corpus/gap/SIP calcs
};

export type RetirementInput = {
  currentAge: number;
  retirementAge: number;
  lifespanAge: number;
  currentMonthlyExpense: number;
  inflationPct: number;
  preReturnPct: number;   // return for monthly investment + required top-up SIP only
  postReturnPct: number;
  phases: ExpensePhase[];
  assetClasses: AssetClass[]; // replaces currentCorpus; always the 4 fixed keys, in order
  currentMonthlyInvestment: number;
};
```

`currentCorpus: number` is removed from `RetirementInput`. A derived,
read-only value ("current corpus counted toward retirement") is computed in
the UI as the sum of `amount` over asset classes with
`includeInRetirement: true`.

Default asset classes (used for a brand-new plan and for migration —
see below):

| key | label | default amount | default rate | default included |
|---|---|---|---|---|
| mutualFund | Mutual Fund | 0 | 12% | true |
| gold | Gold | 0 | 8% | true |
| epfo | EPFO | 0 | 8.25% | true |
| realEstate | Real Estate | 0 | 8% | true |

## Engine calculation changes (`lib/finance/retirement.ts`)

- **New helper** `includedCorpusFutureValue(assetClasses, years)`: for each
  class with `includeInRetirement: true`, computes
  `accumulate({ lumpsum: amount, monthlySip: 0, stepUpPct: 0, annualReturn: ratePct, years, inflationPct: 0 }).futureValue`
  and sums them. Each class compounds independently at its own rate.
  Excluded classes are skipped entirely — their amount/rate are still
  stored (so toggling back on doesn't lose data) but never enter this sum.

- **`requiredSip`** changes signature from `(target, years, annualReturnPct,
  currentCorpus)` to `(target, years, annualReturnPct, grownCorpus)`. It no
  longer grows a corpus internally — the caller passes in the corpus
  already grown to the target date (via `includedCorpusFutureValue` for the
  retirement engine's use, or directly for any other caller). The
  `remaining = target - grownCorpus` / `fvPerUnit` solve logic is
  unchanged.

- **`computeRetirement`**:
  - `requiredMonthlySip` / `extraSipToCloseGap` call
    `requiredSip(corpusNeededAtRetirement, accumYears, input.preReturnPct, includedCorpusFutureValue(input.assetClasses, accumYears))`.
  - `projectedCorpusFromCurrentPlan` =
    `includedCorpusFutureValue(input.assetClasses, accumYears)` +
    the future value of the monthly-investment stream alone
    (`accumulate({ lumpsum: 0, monthlySip: input.currentMonthlyInvestment, ... , annualReturn: preReturnPct })`).

- **`computeAccumulationSplit`**: the `required` yearly series becomes the
  index-by-index sum of:
  - each included asset class's own yearly series
    (`accumulate({ lumpsum: amount, monthlySip: 0, annualReturn: ratePct, years: accumYears, ... }).series`), and
  - the required-SIP yearly series
    (`accumulate({ lumpsum: 0, monthlySip: requiredMonthlySip, annualReturn: preReturnPct, years: accumYears, ... }).series`).

  All series share the same `years` input, so they're the same length and
  can be summed by index (`{ month, invested: sum of invested, value: sum
  of value }`). `surplus` is unchanged (still just the leftover monthly
  investment growing at `preReturnPct`, lumpsum 0).

- Excluded asset classes never appear in `required`/`surplus`, in
  `corpusNeededAtRetirement`/`gap`, or in the drawdown table. They are
  fully invisible to every calculation — informational only via UI copy
  (see below), not a separate chart line.

## UI changes

- **`components/retirement/RetirementInputs.tsx`**: remove `currentCorpus`
  from the flat `numFields` list.
- **New `components/retirement/AssetClassTable.tsx`**: a simple table, one
  row per fixed asset class (Mutual Fund, Gold, EPFO, Real Estate), columns:
  Amount (₹), Rate (%), Include in retirement (checkbox). Below the table:
  - A read-only summary line: "Current corpus counted toward retirement:
    ₹X" (sum of included amounts).
  - Caption above the table: "Included assets are assumed fully liquid and
    available to fund retirement expenses. Excluded assets aren't counted
    in any total or calculation below."
  - Small caption under the EPFO row: "8.25% is the current government-
    declared EPF rate — edit if you expect it to change."
- **`preReturnPct` field relabel**: label changes from "Pre-retirement
  return (%)" to "Return on monthly investment / required SIP (%)".
- **Caption near `postReturnPct`** ("Post-retirement return (%)"):
  "Applied as one blended rate to your whole retirement corpus during
  drawdown, regardless of which asset classes funded it."
- **Handoff button** ("Plan this in Calculator",
  `components/retirement/RetirementTab.tsx`): `lumpsum` changes from
  `input.currentCorpus` to the sum of `amount` over **included** asset
  classes only (today's value, not grown) — matching what the retirement
  calc itself counts, instead of previously-planned "all assets regardless
  of inclusion". `annualReturn` stays `input.preReturnPct` as the blended
  approximation. Small note by the button: "Uses only the asset classes
  counted toward retirement (see checkboxes above)."

## Migration (`store/retirementPlan.ts`)

`loadPlan()` detects the old saved shape: `currentCorpus` is a number and
`assetClasses` is absent. When detected, it migrates in-memory (does not
silently mutate localStorage until the next `savePlan` call, same as
today's flow):

- `mutualFund.amount = old currentCorpus`, `mutualFund.ratePct = old
  preReturnPct`, `mutualFund.includeInRetirement = true`.
- `gold`, `epfo`, `realEstate` get their default amount (0), default rate
  (from the table above), `includeInRetirement = true`.

This preserves an existing user's saved corpus instead of resetting it to
zero on first load after the change ships.

## Testing

- Update shared test fixtures (`base`/`DEFAULT`) in
  `lib/finance/__tests__/retirement.test.ts`,
  `store/__tests__/retirementPlan.test.ts`,
  `components/retirement/__tests__/RetirementAgeCompare.test.tsx`,
  `components/retirement/__tests__/RetirementTab.test.tsx` to the new
  `assetClasses` shape.
- New test: an asset class with `includeInRetirement: false` is excluded
  from `requiredMonthlySip`, `projectedCorpusFromCurrentPlan`, and the
  `computeAccumulationSplit` `required` series (verifies it's fully
  invisible to calculations, not just zero-weighted).
- New test: two included asset classes with different rates both compound
  correctly and sum correctly in `includedCorpusFutureValue`.
- New test: `loadPlan()` migrates an old-shape saved plan (`currentCorpus`
  present, `assetClasses` absent) into the new shape, preserving the
  corpus value in `mutualFund`.
- New test: handoff `lumpsum` sums only included asset classes.
