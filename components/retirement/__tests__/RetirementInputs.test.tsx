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
