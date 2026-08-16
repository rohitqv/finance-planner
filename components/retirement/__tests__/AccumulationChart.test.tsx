import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import AccumulationChart from "@/components/retirement/AccumulationChart";
import type { MonthlyPoint } from "@/lib/finance/types";

const required: MonthlyPoint[] = [
  { month: 12, invested: 600_000, value: 650_000 },
];

describe("AccumulationChart", () => {
  it("renders without crashing when surplus is null", () => {
    const { container } = render(<AccumulationChart required={required} surplus={null} startAge={30} />);
    expect(container.querySelector("svg, .recharts-wrapper")).toBeTruthy();
  });

  it("renders without crashing when surplus is present", () => {
    const surplus: MonthlyPoint[] = [{ month: 12, invested: 200_000, value: 210_000 }];
    const { container } = render(<AccumulationChart required={required} surplus={surplus} startAge={30} />);
    expect(container.querySelector("svg, .recharts-wrapper")).toBeTruthy();
  });
});
