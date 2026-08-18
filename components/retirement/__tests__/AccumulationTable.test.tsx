import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AccumulationTable from "@/components/retirement/AccumulationTable";
import type { MonthlyPoint } from "@/lib/finance/types";

const required: MonthlyPoint[] = [
  { month: 12, invested: 600_000, value: 650_000 },
  { month: 24, invested: 1_200_000, value: 1_380_000 },
];

describe("AccumulationTable", () => {
  it("shows only Required when there is no surplus", () => {
    render(<AccumulationTable required={required} surplus={null} startAge={30} />);
    fireEvent.click(screen.getByText("Show year-by-year numbers"));
    expect(screen.getByText("31")).toBeInTheDocument();
    expect(screen.getByText("32")).toBeInTheDocument();
    expect(screen.queryByText(/surplus/i)).not.toBeInTheDocument();
  });

  it("shows Required, Surplus, and Total columns when there is a surplus", () => {
    const surplus: MonthlyPoint[] = [
      { month: 12, invested: 200_000, value: 210_000 },
      { month: 24, invested: 400_000, value: 440_000 },
    ];
    render(<AccumulationTable required={required} surplus={surplus} startAge={30} />);
    fireEvent.click(screen.getByText("Show year-by-year numbers"));
    expect(screen.getByText(/surplus/i)).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
  });

  it("renders nothing (no rows) for an empty series", () => {
    render(<AccumulationTable required={[]} surplus={null} startAge={30} />);
    expect(screen.queryByRole("row", { name: /31/ })).not.toBeInTheDocument();
  });
});
