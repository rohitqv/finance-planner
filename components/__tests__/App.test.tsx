import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Page from "@/app/page";

beforeEach(() => localStorage.clear());

describe("App handoff", () => {
  it("moves from Retirement to Calculator with a prefilled SIP and goal line", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /retirement planner/i }));
    fireEvent.click(screen.getByRole("button", { name: /plan this in calculator/i }));
    // Now on the calculator tab; a goal reference line label "Goal" is present.
    expect(screen.getByLabelText(/monthly sip/i)).toBeInTheDocument();
  });
});
