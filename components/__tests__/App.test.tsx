import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Page from "@/app/page";

beforeEach(() => localStorage.clear());

describe("App handoff", () => {
  it("moves from Retirement to Calculator with a prefilled SIP", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /retirement planner/i }));
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));

    // Now on the calculator tab. RetirementTab's default inputs (currentAge
    // 30, retirementAge 55, currentMonthlyExpense 50000, etc.) compute a
    // requiredMonthlySip of ~36,269, which the handoff rounds and hands to
    // CalculatorTab's `initial` prop. We deliberately avoid asserting that
    // exact figure (it's derived from a chain of financial-math computations
    // and could drift by a rupee with formula/rounding tweaks); instead we
    // assert the field was actually overwritten from the Calculator tab's
    // own hardcoded default (10000) to a materially larger value, which can
    // only happen if the handoff payload really reached CalculatorTab.
    const sipInput = screen.getByLabelText(/monthly sip/i) as HTMLInputElement;
    const sipValue = Number(sipInput.value);
    expect(sipValue).not.toBe(10000);
    expect(sipValue).toBeGreaterThan(20000);
  });
});
