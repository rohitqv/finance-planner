import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import ResultCards from "@/components/calculator/ResultCards";
import type { CalculatorResult } from "@/lib/finance/types";

const positiveResult: CalculatorResult = {
  futureValue: 8_542_000,
  totalInvested: 3_600_000,
  gain: 4_942_000,
  cagr: 0.142,
  xirr: 0.138,
  inflationAdjustedFV: 6_210_000,
};

const negativeResult: CalculatorResult = {
  futureValue: 900_000,
  totalInvested: 1_000_000,
  gain: -100_000,
  cagr: -0.02,
  xirr: -0.015,
  inflationAdjustedFV: 850_000,
};

function cardFor(label: string) {
  return screen.getByText(label).parentElement as HTMLElement;
}

describe("ResultCards", () => {
  it("renders a positive Gain card in green with an up icon", () => {
    render(<ResultCards result={positiveResult} />);
    const card = cardFor("Gain");
    expect(card.className).toContain("bg-green-50");
    expect(within(card).getByText("▲")).toBeInTheDocument();
    expect(within(card).getByText("₹49,42,000")).toBeInTheDocument();
  });

  it("renders a negative Gain card in red with a down icon and the absolute value (no leading minus)", () => {
    render(<ResultCards result={negativeResult} />);
    const card = cardFor("Gain");
    expect(card.className).toContain("bg-red-50");
    expect(within(card).getByText("▼")).toBeInTheDocument();
    expect(within(card).getByText("₹1,00,000")).toBeInTheDocument();
    expect(within(card).queryByText(/₹-/)).not.toBeInTheDocument();
  });

  it("colors CAGR and XIRR the same way as Gain", () => {
    render(<ResultCards result={negativeResult} />);
    expect(cardFor("CAGR").className).toContain("bg-red-50");
    expect(cardFor("XIRR").className).toContain("bg-red-50");
    expect(within(cardFor("CAGR")).getByText("2.00%")).toBeInTheDocument();
    expect(within(cardFor("XIRR")).getByText("1.50%")).toBeInTheDocument();
  });

  it("leaves neutral cards (Future Value, Total Invested, Inflation-adjusted FV) uncolored", () => {
    render(<ResultCards result={negativeResult} />);
    const card = cardFor("Future Value");
    expect(card.className).not.toContain("bg-green-50");
    expect(card.className).not.toContain("bg-red-50");
    expect(card.className).toContain("border");
  });

  it("includes a screen-reader-only 'negative' indicator on a negative Gain card", () => {
    render(<ResultCards result={negativeResult} />);
    const card = cardFor("Gain");
    expect(within(card).getByText("negative")).toBeInTheDocument();
  });

  it("does not include a screen-reader-only 'negative' indicator on a positive Gain card", () => {
    render(<ResultCards result={positiveResult} />);
    const card = cardFor("Gain");
    expect(within(card).queryByText("negative")).not.toBeInTheDocument();
  });

  it("does not apply opacity-70 to signed-card labels", () => {
    render(<ResultCards result={positiveResult} />);
    expect(screen.getByText("Gain").className).not.toContain("opacity-70");
  });
});
