import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import RetirementTab from "@/components/retirement/RetirementTab";

beforeEach(() => localStorage.clear());

describe("RetirementTab", () => {
  it("shows the corpus needed and a required SIP", () => {
    render(<RetirementTab />);
    expect(screen.getAllByText(/corpus needed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/required monthly sip/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/₹/).length).toBeGreaterThan(0);
  });

  it("calls onHandoff with the required SIP and corpus goal", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    expect(onHandoff).toHaveBeenCalledTimes(1);
    const arg = onHandoff.mock.calls[0][0];
    expect(arg.corpusGoal).toBeGreaterThan(0);
    expect(arg.monthlySip).toBeGreaterThan(0);
  });

  it("includes the plan's own return and inflation assumptions in the handoff payload, not the Calculator's defaults", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    // Change the pre-retirement return away from the value that happens to
    // coincide with the Calculator tab's hardcoded default (12%), so this
    // test can actually distinguish "wired through" from "silently dropped".
    fireEvent.change(screen.getByLabelText(/return on monthly investment/i), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText(/^inflation/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    const arg = onHandoff.mock.calls[0][0];
    expect(arg.annualReturn).toBe(8);
    expect(arg.inflationPct).toBe(5);
  });

  it("hands off a lumpsum equal to the sum of included asset-class amounts only", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    fireEvent.change(screen.getByLabelText("Mutual Fund amount"), { target: { value: "100000" } });
    fireEvent.change(screen.getByLabelText("Real Estate amount"), { target: { value: "9000000" } });
    fireEvent.click(screen.getByLabelText("Include Real Estate in retirement")); // exclude it
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    const arg = onHandoff.mock.calls[0][0];
    expect(arg.lumpsum).toBe(100000);
  });

  it("removes the handoff button (and does not call onHandoff) when retirement age <= current age", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    // Default currentAge is 30; setting retirementAge to the same value
    // leaves zero years to accumulate, so requiredMonthlySip is an explicit
    // Infinity (lib/finance/retirement.ts) that must never reach the
    // Calculator tab. The plan no longer validates at all, so the results
    // panel — and with it the handoff button — is replaced by the summary,
    // a stronger guarantee than the disabled button this used to assert.
    fireEvent.change(screen.getByLabelText(/retirement age/i), { target: { value: "30" } });
    expect(screen.queryByRole("button", { name: /plan this in calculator/i })).not.toBeInTheDocument();
    expect(screen.getByText(/retirement age must be greater than current age/i)).toBeInTheDocument();
    expect(onHandoff).not.toHaveBeenCalled();
  });

  it("shows a warning instead of ₹0 metrics when lifespan age <= retirement age", () => {
    render(<RetirementTab />);
    fireEvent.change(screen.getByLabelText(/lifespan age/i), { target: { value: "50" } }); // < default retirementAge 55
    expect(screen.getByText(/lifespan must be greater than retirement age/i)).toBeInTheDocument();
    // "Required monthly SIP" also appears as a row label in the age-compare
    // table further down, so assert on a metric that's unique to the
    // RetirementResults card grid this warning replaces.
    expect(screen.queryByText(/extra sip to close gap/i)).not.toBeInTheDocument();
  });
});

describe("RetirementTab drawdown views", () => {
  // Default currentMonthlyInvestment is 0, so the projected corpus is 0 and
  // the very first retirement year is already unfunded.
  it("opens on the user's own projection, not the required-corpus curve", () => {
    render(<RetirementTab />);
    expect(screen.getByRole("button", { name: /your projection/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /required corpus/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("names the age the projected corpus runs out", () => {
    render(<RetirementTab />);
    fireEvent.change(screen.getByLabelText(/current monthly investment/i), { target: { value: "25000" } });
    expect(screen.getByText(/runs out at age/i)).toBeInTheDocument();
  });

  it("says so plainly when the projection covers the whole retirement", () => {
    render(<RetirementTab />);
    fireEvent.change(screen.getByLabelText(/current monthly investment/i), { target: { value: "500000" } });
    expect(screen.getByText(/funds every year through age/i)).toBeInTheDocument();
    expect(screen.queryByText(/runs out at age/i)).not.toBeInTheDocument();
  });

  it("switches the year-by-year table between the two corpora", () => {
    render(<RetirementTab />);
    expect(screen.getByText(/year-by-year drawdown — your projection/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /required corpus/i }));
    expect(screen.getByText(/year-by-year drawdown — required corpus/i)).toBeInTheDocument();
  });

  // The required corpus is solved to fund every year, so a shortfall column
  // there would be a column of dashes; the projection is where it matters.
  it("shows a shortfall column only for a projection that falls short", () => {
    render(<RetirementTab />);
    fireEvent.change(screen.getByLabelText(/current monthly investment/i), { target: { value: "25000" } });
    fireEvent.click(screen.getByRole("button", { name: /show year-by-year drawdown/i }));
    expect(screen.getByRole("columnheader", { name: /shortfall/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /required corpus/i }));
    expect(screen.queryByRole("columnheader", { name: /shortfall/i })).not.toBeInTheDocument();
  });
});
