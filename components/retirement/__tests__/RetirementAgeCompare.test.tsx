import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RetirementAgeCompare from "@/components/retirement/RetirementAgeCompare";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};

describe("RetirementAgeCompare", () => {
  it("renders a column per retirement age", () => {
    render(<RetirementAgeCompare base={base} ages={[50, 55, 60]} />);
    expect(screen.getByText(/Retire @ 50/)).toBeInTheDocument();
    expect(screen.getByText(/Retire @ 55/)).toBeInTheDocument();
    expect(screen.getByText(/Retire @ 60/)).toBeInTheDocument();
  });
});
