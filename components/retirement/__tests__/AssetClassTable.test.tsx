import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AssetClassTable from "@/components/retirement/AssetClassTable";
import { DEFAULT_ASSET_CLASSES } from "@/lib/finance/retirement";

describe("AssetClassTable", () => {
  it("renders all four fixed asset classes", () => {
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={vi.fn()} />);
    expect(screen.getByText("Mutual Fund")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText("EPFO")).toBeInTheDocument();
    expect(screen.getByText("Real Estate")).toBeInTheDocument();
  });

  it("calls onChange with an updated amount when an amount field changes", () => {
    const onChange = vi.fn();
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("EPFO amount"), { target: { value: "300000" } });
    const updated = onChange.mock.calls[0][0];
    expect(updated.find((a: { key: string }) => a.key === "epfo").amount).toBe(300000);
    // Other classes are untouched.
    expect(updated.find((a: { key: string }) => a.key === "gold").amount).toBe(0);
  });

  it("calls onChange with an updated rate when a rate field changes", () => {
    const onChange = vi.fn();
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("EPFO rate"), { target: { value: "9.5" } });
    const updated = onChange.mock.calls[0][0];
    expect(updated.find((a: { key: string }) => a.key === "epfo").ratePct).toBe(9.5);
  });

  it("calls onChange with includeInRetirement toggled off", () => {
    const onChange = vi.fn();
    render(<AssetClassTable value={DEFAULT_ASSET_CLASSES} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("Include Real Estate in retirement"));
    const updated = onChange.mock.calls[0][0];
    expect(updated.find((a: { key: string }) => a.key === "realEstate").includeInRetirement).toBe(false);
  });

  it("shows the corpus counted toward retirement as the sum of included amounts only", () => {
    const classes = DEFAULT_ASSET_CLASSES.map((a) => {
      if (a.key === "mutualFund") return { ...a, amount: 100_000, includeInRetirement: true };
      if (a.key === "realEstate") return { ...a, amount: 9_000_000, includeInRetirement: false };
      return a;
    });
    render(<AssetClassTable value={classes} onChange={vi.fn()} />);
    expect(screen.getByText(/current corpus counted toward retirement/i)).toBeInTheDocument();
    expect(screen.getByText("₹1,00,000")).toBeInTheDocument();
  });
});
