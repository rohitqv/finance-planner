import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DrawdownTable from "@/components/retirement/DrawdownTable";
import type { DrawdownRow, BucketDrawdownRow } from "@/lib/finance/retirement";

const flatRows: DrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000, shortfall: 0 },
];

const bucketRows: BucketDrawdownRow[] = [
  { age: 60, year: 2056, yearsFromNow: 30, annualExpenseToday: 600_000, annualExpenseInflated: 1_200_000, corpusBalance: 5_000_000, shortfall: 0, safeBalance: 2_000_000, growthBalance: 3_000_000 },
];

describe("DrawdownTable", () => {
  it("shows a single 'Corpus balance' column for plain DrawdownRow[]", () => {
    render(<DrawdownTable rows={flatRows} />);
    fireEvent.click(screen.getByText("Show year-by-year drawdown"));
    expect(screen.getByText("Corpus balance")).toBeInTheDocument();
    expect(screen.queryByText("Safe bucket")).not.toBeInTheDocument();
  });

  it("shows Safe bucket / Growth bucket / Total columns for BucketDrawdownRow[]", () => {
    render(<DrawdownTable rows={bucketRows} />);
    fireEvent.click(screen.getByText("Show year-by-year drawdown"));
    expect(screen.getByText("Safe bucket")).toBeInTheDocument();
    expect(screen.getByText("Growth bucket")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("₹20,00,000")).toBeInTheDocument();
    expect(screen.getByText("₹30,00,000")).toBeInTheDocument();
  });
});
