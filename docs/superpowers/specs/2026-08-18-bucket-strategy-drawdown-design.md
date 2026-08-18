# Bucket-strategy retirement drawdown — design

## Problem

Today, `computeRetirement` in [lib/finance/retirement.ts](../../../lib/finance/retirement.ts) applies a single flat `postReturnPct` to the *entire* remaining retirement corpus every year of the drawdown (see the loop at `retirement.ts:126-135`). In reality, a retiree with a large corpus and near-term expenses doesn't leave the whole balance earning one blended rate — they typically hold a few years of expenses in something safe (FD) and let the rest keep compounding at equity-like rates, refilling the safe pot periodically. This is the well-known "bucket strategy" for retirement withdrawals.

The existing `postReturnPct` input already carries a hint acknowledging this simplification (`RetirementInputs.tsx:14`): *"Applied as one blended rate to your whole retirement corpus during drawdown, regardless of which asset classes funded it."*

This design adds bucket-strategy drawdown as an **alternate, opt-in mode** alongside the existing flat-rate model, plus a small "Resources" tab linking to reference reading on the strategy.

## Non-goals

- No Monte Carlo / stochastic market simulation. This stays a deterministic, closed-form-or-bisected calculation, consistent with the rest of the app (no AI/model calls — see rationale below).
- Not modeling "opportunistic" refills (e.g. topping up more after a strong equity year) — the deterministic model has no year-to-year volatility to react to, so a simple annual top-up-to-target captures the mechanic without inventing a rule the data can't justify.
- Not replacing the existing flat-rate `postReturnPct` model. Both coexist.
- Not changing the accumulation-phase (pre-retirement) calculation at all.

## Why deterministic, not AI

The whole calculation — withdraw, grow two balances at two fixed rates, refill — is pure, reproducible arithmetic, the same shape as the existing year-by-year loop in `computeRetirement`. A financial calculator needs to be auditable and testable (same inputs → same output, every time); an LLM call would add latency, cost, and non-determinism for no benefit, and couldn't be unit tested the way `retirement.test.ts` tests the rest of this module.

## Data model changes

`RetirementInput` (`lib/finance/retirement.ts`) gains:

```ts
useBucketStrategy: boolean;   // default false — opt-in, existing behavior unchanged when off
bucketYears: number;          // default 5 — years of (inflated) expense kept in the safe bucket
safeBucketRatePct: number;    // default 7
growthBucketRatePct: number;  // default 11
```

These are dedicated fields, independent of the existing `assetClasses` (Fixed Deposit rate) and `postReturnPct` — changing one does not affect the other. When `useBucketStrategy` is `false`, every existing code path is unchanged.

## Calculation model

Two new functions in `lib/finance/retirement.ts`:

### `simulateBucketDrawdown(input, startingCorpus): BucketDrawdownRow[]`

For each year of retirement (`retirementAge` .. `lifespanAge`):
1. Withdraw this year's inflated expense from the safe bucket.
2. Grow the safe bucket balance at `safeBucketRatePct`, the growth bucket at `growthBucketRatePct`.
3. Top the safe bucket back up to `bucketYears` worth of the *next* years' inflated expenses, transferring the shortfall from the growth bucket. If the growth bucket can't cover it, transfer whatever remains (growth bucket floors at 0).

If both buckets are exhausted, all subsequent balances clamp to 0 — the same `Math.max(0, ...)` behavior as the existing flat-rate loop, not a bucket-specific error state.

```ts
export type BucketDrawdownRow = DrawdownRow & {
  safeBalance: number;
  growthBalance: number;
  // corpusBalance (inherited) = safeBalance + growthBalance
};
```

### `solveBucketCorpusNeeded(input): number`

The existing flat-rate model computes `corpusNeededAtRetirement` as a closed-form discounted sum (one rate ⇒ one PV formula). With two different rates governing two balances that interact via annual refills, there's no equivalent closed form. Instead:

- Bracket-and-bisect on the **starting total corpus** `C`: split `C` into an initial safe bucket (`bucketYears` worth of inflated expense at retirement) and growth bucket (`C` minus that), run `simulateBucketDrawdown`, and check the ending balance at `lifespanAge`.
- Ending balance is monotonically increasing in `C` (more starting money never leaves you worse off under fixed positive rates), so bisection converges reliably.
- This mirrors the bracket-and-bisect XIRR solver already in [lib/finance/returns.ts](../../../lib/finance/returns.ts:23) (added in `496430f`) — same technique, different variable (corpus amount instead of a rate).

When `useBucketStrategy` is `true`, `corpusNeededAtRetirement`, `corpusNeededToday`, and `requiredMonthlySip` are all derived from this solved value instead of the flat-rate formula, so the SIP recommendation stays consistent with what the bucket chart/table actually show. `RetirementResult.drawdown` becomes `BucketDrawdownRow[]` in this mode.

## UI changes

### RetirementInputs

A checkbox "Use bucket strategy for drawdown" reveals the three new fields (`bucketYears`, `safeBucketRatePct`, `growthBucketRatePct`) when checked, following the existing pattern of conditionally-shown fields in the component. The existing `postReturnPct` field and its hint remain, used only when the checkbox is off.

### DrawdownChart

Extended to accept `BucketDrawdownRow[]` and render two separate `Line`s (growth bucket, safe bucket) instead of the single `Area`, when bucket rows are present. Plain `DrawdownRow[]` (flat-rate mode) renders exactly as today — no visual change for existing users.

### DrawdownTable

Gains `Safe bucket` / `Growth bucket` / `Total` columns when rows include bucket fields; unchanged otherwise.

### New "Resources" tab

Third tab in [components/Tabs.tsx](../../../components/Tabs.tsx), backed by a new `ResourcesTab` component. Static list of links only (no reproduced article content):

- [Retirement Corpus Generation (Zerodha Varsity)](https://zerodha.com/varsity/chapter/the-retirement-problem-part-2/)
- [Retirement Bucket Strategy (White Coat Investor)](https://www.whitecoatinvestor.com/retirement-bucket-strategy/)
- [Bucket Strategies Comparison (Morningstar, PDF)](https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt2da7af775da0d57e/65aacbb9c7bb160246a29912/Bucket_Strategies_Comparison_(3)_(1).pdf)

Each with a one-line note on what it covers.

## Testing

- `lib/finance/__tests__/retirement.test.ts`: `simulateBucketDrawdown` refill math and depletion clamp; `solveBucketCorpusNeeded` convergence against a hand-computed small case, and agreement with `simulateBucketDrawdown` (solved corpus, simulated forward, ends at ~0 at `lifespanAge`).
- Component tests: `DrawdownChart`/`DrawdownTable` render bucket columns/line only when bucket rows are passed, unchanged otherwise; new `ResourcesTab` renders its links.

## Open questions for implementation

None outstanding — defaults, refill cadence, depletion handling, target-corpus solve method, display, and tab naming were all settled during brainstorming.
