# Result card visual polish (color-coding, spacing, hierarchy)

## Goal

Give the result cards across both tabs — Calculator's `ResultCards` and
Retirement's `RetirementResults` — a more polished look: color-code signed
metrics (gain/loss, shortfall/surplus) so their meaning is visible at a
glance, and improve spacing/shape so cards read as a deliberate design
rather than bare `rounded border p-3` boxes.

Chosen through visual brainstorming (three card-style options compared
side by side, then a flat-vs-hero layout comparison): tinted background +
icon for signed cards ("Option B"), equal-size cards throughout ("Flat" —
no hero/enlarged primary metric).

## Non-goals

- **No dark mode.** The tint colors below are chosen against the current
  light-only palette (`app/globals.css` has only a light
  `--background`/`--foreground` pair). If dark mode is built later, the
  green/red tints will need revisiting — tracked separately, not part of
  this change.
- **No change to which metrics are shown**, their labels, or the
  underlying calculation logic — purely visual treatment of existing
  values.
- **No hero/enlarged primary card.** Considered and explicitly rejected in
  favor of equal-size cards (see Layout below).
- **No changes to `GrowthChart`/`AccumulationChart`/`DrawdownChart`**
  (Recharts visuals) or to `InputPanel`/`RetirementInputs` forms — scoped
  to the two result-card components below.
- **No color-coding for `AccumulationTable`'s Surplus column.** Corrected
  from an earlier draft of this spec, which incorrectly assumed it was a
  signed value like `RetirementResults`' Shortfall/Surplus card. It is
  not: `lib/finance/retirement.ts:194-195` only ever populates
  `split.surplus` when `surplusAmount > 0` (it's `null` otherwise, which
  `AccumulationTable`'s existing "shows only Required when there is no
  surplus" test covers) — the column's value can never be negative, so a
  red/negative branch would be dead, untestable code. `AccumulationTable`
  is untouched by this change.

## Design spec

**Neutral cards** (values with no positive/negative meaning — Future
Value, Total Invested, Corpus needed, Required monthly SIP, Projected
corpus, Extra SIP to close gap):
- `rounded-xl` (up from `rounded`), `p-4` (up from `p-3`), plus a subtle
  shadow (`shadow-sm`) for depth against the plain white background.
- Grid gap increases from `gap-3` to `gap-4` for more breathing room
  between cards.

**Signed cards** (Gain, CAGR, XIRR in `ResultCards`; the Shortfall/Surplus
card in `RetirementResults`):
- Same shape as neutral cards, plus a tinted background:
  `bg-green-50 text-green-700` when the value is ≥ 0 (gain / surplus),
  `bg-red-50 text-red-700` when negative (loss / shortfall).
  - Reuses the exact palette already used for the invalid-lifespan error
    card in `RetirementResults.tsx` (`border-red-400 bg-red-50
    text-red-700`), so this isn't a new color introduced to the app.
  - "Surplus" vs "Shortfall" already flips by sign in
    `RetirementResults.tsx:31` (`result.gap >= 0 ? "Shortfall" : "Surplus"`,
    with the *value* rendered as `Math.abs(result.gap)`) — the color rule
    keys off `result.gap`'s sign directly, independent of which label is
    showing, so a shortfall is always red and a surplus is always green.
- A small ▲ (positive) / ▼ (negative) icon precedes the value,
  `aria-hidden="true"` since it's decorative — the color+icon pairing
  together means the signal isn't conveyed by color alone (colorblind
  accessibility).
- **Correction (found in final review):** the icon being `aria-hidden`
  is only safe where the *label itself* already carries the sign in
  words. That's true in `RetirementResults` — the label swaps between
  "Shortfall" and "Surplus" by sign, so a screen reader still gets the
  full meaning even with the icon hidden and the value shown as
  `Math.abs(...)`. It is NOT true in `ResultCards`: the label is a
  constant ("Gain", "CAGR", "XIRR") regardless of sign, so with the icon
  hidden and the value's own `-` stripped by `Math.abs`, a screen reader
  would read a −₹1,00,000 loss identically to a +₹1,00,000 gain — a
  regression from the pre-change behavior, where `formatINR`'s raw `-`
  was at least audible. `ResultCards`' signed cards therefore need an
  additional `<span className="sr-only">negative </span>` immediately
  before the value when `!positive`, so the announced text becomes
  "Gain negative ₹1,00,000" for a loss. `RetirementResults` needs no
  such span — its label already disambiguates.
- Signed-card labels use the same full-opacity `text-green-700`/
  `text-red-700` as the rest of the card (inherited, no `opacity-*`
  override). An earlier implementation reduced the label to 70% opacity
  for a visually "muted" look; that composites the text color toward the
  light tint background and drops contrast below WCAG AA (measured
  ~2.8:1–3.6:1 against the ≥4.5:1 requirement for the two tint colors).
  The label must stay at full opacity, matching the value's contrast.
- The value itself is formatted from `Math.abs(...)`, not the raw signed
  number — `formatINR`'s `toLocaleString` puts a bare `-` before the
  digits (e.g. `formatINR(-500000)` → `"₹-5,00,000"`), which would double
  up with the ▼ icon into a redundant/confusing `"▼₹-5,00,000"`.
  `RetirementResults.tsx` already does this for the Shortfall/Surplus card
  (`Math.abs(result.gap)`, since the label already says which one it is)
  — apply the same `Math.abs` pattern to Gain/CAGR/XIRR so the icon is the
  only sign indicator. `formatPct` (used for CAGR/XIRR) has no such
  leading-`-` quirk but gets the same `Math.abs` treatment for consistency
  between the two.

**Layout**: cards stay equal-size ("flat") in both `ResultCards` and
`RetirementResults` — no enlarged hero card for the primary metric. This
was directly compared against a hero variant during brainstorming and the
flat layout was preferred.

## Component changes

- `components/calculator/ResultCards.tsx`: add a `positive: boolean`
  (or equivalent sign check) per signed card entry (Gain, CAGR, XIRR);
  render tinted background + icon for those three, neutral styling for
  Future Value/Total Invested/Inflation-adjusted FV.
- `components/retirement/RetirementResults.tsx`: apply the same tinted +
  icon treatment to the Shortfall/Surplus card only, keyed off
  `result.gap`'s sign; other five cards get the neutral spacing/shape
  update only.
- No changes to `lib/finance/*` — this is presentation-only; existing
  `formatINR`/`formatPct` outputs are wrapped with the new styling, not
  altered.

## Testing

- Extend existing component tests (`ResultCards` currently has no
  dedicated test file — check `CalculatorTab.test.tsx` /
  `RetirementTab.test.tsx` for where card rendering is covered) to assert:
  a negative Gain/CAGR/XIRR renders with the red-tint class, ▼ icon, and
  the absolute-value formatted number (no leading `-`); a positive one
  with green-tint, ▲, and the plain formatted number.
- `RetirementResults` has no dedicated test file today (only covered
  indirectly through `RetirementTab.test.tsx`, which doesn't currently
  assert the Shortfall/Surplus label or color). Add
  `components/retirement/__tests__/RetirementResults.test.tsx` asserting
  both the label swap and the new color/icon follow `result.gap`'s sign
  correctly in both directions.
- No new test infrastructure needed — same Testing Library patterns
  already used throughout `components/**/__tests__`.
