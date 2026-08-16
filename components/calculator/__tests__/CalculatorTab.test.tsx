import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CalculatorTab from "@/components/calculator/CalculatorTab";

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
});
