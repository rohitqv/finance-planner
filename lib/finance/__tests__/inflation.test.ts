import { describe, it, expect } from "vitest";
import { realValue } from "@/lib/finance/inflation";

describe("realValue", () => {
  it("discounts nominal by inflation", () => {
    expect(realValue(1_000_000, 7, 10)).toBeCloseTo(1_000_000 / Math.pow(1.07, 10), 2);
  });
  it("is a no-op at zero inflation", () => {
    expect(realValue(500_000, 0, 20)).toBe(500_000);
  });
});
