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
  projectedDrawdown: [],
  projectedDepletionAge: null,
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

  // The invalid-lifespan escape hatch this component used to own now lives in
  // the shared validator, and RetirementTab renders a ValidationSummary
  // instead of this component when a plan doesn't validate. See
  // RetirementTab.test.tsx for that behaviour end-to-end.
  it("renders results unconditionally, leaving invalid input to the validator", () => {
    render(<RetirementResults result={shortfallResult} />);
    expect(screen.queryByText(/lifespan must be greater/i)).not.toBeInTheDocument();
    expect(screen.getByText("Shortfall")).toBeInTheDocument();
  });

  it("does not apply opacity-70 to the Shortfall/Surplus label", () => {
    render(<RetirementResults result={shortfallResult} />);
    expect(screen.getByText("Shortfall").className).not.toContain("opacity-70");
  });
});
