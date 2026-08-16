import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RetirementAgeCompare from "@/components/retirement/RetirementAgeCompare";
import type { RetirementInput } from "@/lib/finance/retirement";

const base: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

describe("RetirementAgeCompare", () => {
  it("renders a column per retirement age", () => {
    render(<RetirementAgeCompare base={base} ages={[50, 55, 60]} />);
    expect(screen.getByText(/Retire @ 50/)).toBeInTheDocument();
    expect(screen.getByText(/Retire @ 55/)).toBeInTheDocument();
    expect(screen.getByText(/Retire @ 60/)).toBeInTheDocument();
  });
});
