import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import DrawdownChart from "@/components/retirement/DrawdownChart";
import type { DrawdownRow, BucketDrawdownRow } from "@/lib/finance/retirement";

const flatRows: DrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000, shortfall: 0 },
];

const bucketRows: BucketDrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000, shortfall: 0, safeBalance: 2_000_000, growthBalance: 3_000_000 },
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
