import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import { loadScenarios } from "@/store/scenarios";

beforeEach(() => localStorage.clear());

describe("CalculatorTab", () => {
  it("shows a future value for a lumpsum", () => {
    render(<CalculatorTab />);
    const lumpsum = screen.getByLabelText(/lumpsum/i) as HTMLInputElement;
    fireEvent.change(lumpsum, { target: { value: "1000000" } });
    expect(screen.getByText(/future value/i)).toBeInTheDocument();
    // A ₹ amount is rendered somewhere in the results.
    expect(screen.getAllByText(/₹/).length).toBeGreaterThan(0);
  });

  it("saves a scenario", () => {
    render(<CalculatorTab />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Aggressive" } });
    fireEvent.click(screen.getByRole("button", { name: /save scenario/i }));
    expect(screen.getByText("Aggressive")).toBeInTheDocument();
  });

  it("sanitizes a non-finite `initial` prop instead of rendering it (defensive boundary for the retirement handoff)", () => {
    // `initial` is an external prop boundary — the retirement handoff can in
    // principle produce Infinity (e.g. requiredSip with zero accumulation
    // years, see lib/finance/retirement.ts). CalculatorTab must fall back to
    // its own defaults for any non-finite field rather than rendering
    // `value={Infinity}` or propagating it into calculate().
    render(<CalculatorTab initial={{ monthlySip: Infinity, years: NaN }} />);
    const sipInput = screen.getByLabelText(/monthly sip/i) as HTMLInputElement;
    const yearsInput = screen.getByLabelText(/duration/i) as HTMLInputElement;
    expect(Number(sipInput.value)).toBe(10000); // DEFAULT.monthlySip
    expect(Number(yearsInput.value)).toBe(15); // DEFAULT.years
    expect(screen.getByText(/future value/i)).toBeInTheDocument();
    expect(screen.queryByText(/∞/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it("does not show an Update scenario button until a saved scenario is loaded", () => {
    render(<CalculatorTab />);
    expect(screen.queryByRole("button", { name: /update scenario/i })).not.toBeInTheDocument();
  });

  it("updates the existing scenario in place (not a new one) when loaded, edited, and updated", () => {
    render(<CalculatorTab />);

    // Save an initial scenario.
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Base plan" } });
    fireEvent.click(screen.getByRole("button", { name: /save scenario/i }));
    expect(loadScenarios()).toHaveLength(1);
    const originalId = loadScenarios()[0].id;

    // Load it back into the editor.
    fireEvent.click(screen.getByText("Base plan"));
    expect(screen.queryByRole("button", { name: /update scenario/i })).toBeInTheDocument();

    // Edit an input, then update rather than save-as-new.
    fireEvent.change(screen.getByLabelText(/lumpsum/i), { target: { value: "500000" } });
    fireEvent.click(screen.getByRole("button", { name: /update scenario/i }));

    const list = loadScenarios();
    expect(list).toHaveLength(1); // still just one scenario, not a duplicate
    expect(list[0].id).toBe(originalId); // same scenario, mutated in place
    expect(list[0].lumpsum).toBe(500000);
    expect(list[0].name).toBe("Base plan");
  });
});
