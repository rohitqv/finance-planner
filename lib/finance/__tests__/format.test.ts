import { describe, it, expect } from "vitest";
import {
  formatINR, formatMultiple, formatPct, formatCompactINR,
} from "@/lib/finance/format";

describe("formatINR", () => {
  it("groups in the Indian system", () => {
    expect(formatINR(15200000)).toBe("₹1,52,00,000");
  });
  it("rounds to whole rupees", () => {
    expect(formatINR(1234.56)).toBe("₹1,235");
  });
});

describe("formatCompactINR", () => {
  it("keeps full grouping below a lakh", () => {
    expect(formatCompactINR(12345)).toBe("₹12,345");
  });
  it("renders lakhs compactly, trimming trailing zeros", () => {
    expect(formatCompactINR(5_000_000)).toBe("₹50L");
    expect(formatCompactINR(852_000)).toBe("₹8.52L");
  });
  it("renders crores compactly, trimming trailing zeros", () => {
    expect(formatCompactINR(80_000_000)).toBe("₹8Cr");
    expect(formatCompactINR(10_500_000)).toBe("₹1.05Cr");
  });
  it("handles negative values", () => {
    expect(formatCompactINR(-50_000_000)).toBe("-₹5Cr");
  });
});

describe("formatPct", () => {
  it("renders a fraction as a percent", () => {
    expect(formatPct(0.1234)).toBe("12.34%");
  });
  it("respects decimal places", () => {
    expect(formatPct(0.12, 0)).toBe("12%");
  });
});

describe("formatMultiple", () => {
  it("renders a ratio with an x suffix", () => {
    expect(formatMultiple(2.6192)).toBe("2.62x");
  });
  it("keeps trailing zeros so a column of multiples stays aligned", () => {
    expect(formatMultiple(3)).toBe("3.00x");
  });
  it("respects decimal places", () => {
    expect(formatMultiple(2.6192, 1)).toBe("2.6x");
  });
});
