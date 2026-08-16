import { describe, it, expect } from "vitest";
import { formatINR, formatPct } from "@/lib/finance/format";

describe("formatINR", () => {
  it("groups in the Indian system", () => {
    expect(formatINR(15200000)).toBe("₹1,52,00,000");
  });
  it("rounds to whole rupees", () => {
    expect(formatINR(1234.56)).toBe("₹1,235");
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
