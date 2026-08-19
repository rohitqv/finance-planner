import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RetirementInputs from "@/components/retirement/RetirementInputs";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";

const value: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0, sipStepUpPct: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};

describe("RetirementInputs — bucket strategy", () => {
  it("hides the bucket-strategy fields when the checkbox is off", () => {
    render(<RetirementInputs value={value} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/years of expense kept safe/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/safe bucket rate/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/growth bucket rate/i)).not.toBeInTheDocument();
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

    expect(screen.getByLabelText(/years of expense kept safe/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/safe bucket rate/i), { target: { value: "6.5" } });
    expect(onChange).toHaveBeenCalledWith({ ...checked, safeBucketRatePct: 6.5 });
  });
});
