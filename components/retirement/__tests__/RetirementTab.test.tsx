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
});
