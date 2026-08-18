import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ResourcesTab from "@/components/ResourcesTab";

describe("ResourcesTab", () => {
  it("renders all three reference links with correct hrefs", () => {
    render(<ResourcesTab />);

    const zerodha = screen.getByRole("link", { name: /Retirement Corpus Generation \(Zerodha Varsity\)/ });
    expect(zerodha).toHaveAttribute("href", "https://zerodha.com/varsity/chapter/the-retirement-problem-part-2/");

    const wci = screen.getByRole("link", { name: /Retirement Bucket Strategy \(White Coat Investor\)/ });
    expect(wci).toHaveAttribute("href", "https://www.whitecoatinvestor.com/retirement-bucket-strategy/");

    const morningstar = screen.getByRole("link", { name: /Bucket Strategies Comparison \(Morningstar, PDF\)/ });
    expect(morningstar).toHaveAttribute(
      "href",
      "https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt2da7af775da0d57e/65aacbb9c7bb160246a29912/Bucket_Strategies_Comparison_(3)_(1).pdf",
    );
  });
});
