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
    fireEvent.change(screen.getByLabelText(/pre-retirement return/i), { target: { value: "8" } });
    fireEvent.change(screen.getByLabelText(/^inflation/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    const arg = onHandoff.mock.calls[0][0];
    expect(arg.annualReturn).toBe(8);
    expect(arg.inflationPct).toBe(5);
  });

  it("disables the handoff button (and does not call onHandoff) when retirement age <= current age", () => {
    const onHandoff = vi.fn();
    render(<RetirementTab onHandoff={onHandoff} />);
    // Default currentAge is 30; setting retirementAge to the same value
    // leaves zero years to accumulate, so requiredMonthlySip is an explicit
    // Infinity (lib/finance/retirement.ts) that must never reach the
    // Calculator tab.
    fireEvent.change(screen.getByLabelText(/retirement age/i), { target: { value: "30" } });
    const button = screen.getByRole("button", { name: /plan this in calculator/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
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
