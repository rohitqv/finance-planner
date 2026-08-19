import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import { addScenario, loadScenarios } from "@/store/scenarios";

beforeEach(() => localStorage.clear());

describe("CalculatorTab", () => {
  it("shows a future value for a lumpsum", () => {
    render(<CalculatorTab />);
    const lumpsum = screen.getByLabelText(/lumpsum/i) as HTMLInputElement;
    fireEvent.change(lumpsum, { target: { value: "1000000" } });
    expect(screen.getByText(/future value/i)).toBeInTheDocument();
    // A ₹ amount is rendered somewhere in the results.
    expect(screen.getAllByText(/₹/).length).toBeGreaterThan(0);
  });

  it("saves a scenario", () => {
    render(<CalculatorTab />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Aggressive" } });
    fireEvent.click(screen.getByRole("button", { name: /save scenario/i }));
    expect(screen.getByText("Aggressive")).toBeInTheDocument();
  });

  it("sanitizes a non-finite `initial` prop instead of rendering it (defensive boundary for the retirement handoff)", () => {
    // `initial` is an external prop boundary — the retirement handoff can in
    // principle produce Infinity (e.g. requiredSip with zero accumulation
    // years, see lib/finance/retirement.ts). CalculatorTab must fall back to
    // its own defaults for any non-finite field rather than rendering
    // `value={Infinity}` or propagating it into calculate().
    render(<CalculatorTab initial={{ monthlySip: Infinity, years: NaN }} />);
    const sipInput = screen.getByLabelText(/monthly sip/i) as HTMLInputElement;
    const yearsInput = screen.getByLabelText(/duration/i) as HTMLInputElement;
    expect(Number(sipInput.value)).toBe(10000); // DEFAULT.monthlySip
    expect(Number(yearsInput.value)).toBe(15); // DEFAULT.years
    expect(screen.getByText(/future value/i)).toBeInTheDocument();
    expect(screen.queryByText(/∞/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nan/i)).not.toBeInTheDocument();
  });

  it("does not show an Update scenario button until a saved scenario is loaded", () => {
    render(<CalculatorTab />);
    expect(screen.queryByRole("button", { name: /update scenario/i })).not.toBeInTheDocument();
  });

  it("updates the existing scenario in place (not a new one) when loaded, edited, and updated", () => {
    render(<CalculatorTab />);

    // Save an initial scenario.
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Base plan" } });
    fireEvent.click(screen.getByRole("button", { name: /save scenario/i }));
    expect(loadScenarios()).toHaveLength(1);
    const originalId = loadScenarios()[0].id;

    // Load it back into the editor.
    fireEvent.click(screen.getByText("Base plan"));
    expect(screen.queryByRole("button", { name: /update scenario/i })).toBeInTheDocument();

    // Edit an input, then update rather than save-as-new.
    fireEvent.change(screen.getByLabelText(/lumpsum/i), { target: { value: "500000" } });
    fireEvent.click(screen.getByRole("button", { name: /update scenario/i }));

    const list = loadScenarios();
    expect(list).toHaveLength(1); // still just one scenario, not a duplicate
    expect(list[0].id).toBe(originalId); // same scenario, mutated in place
    expect(list[0].lumpsum).toBe(500000);
    expect(list[0].name).toBe("Base plan");
  });

  describe("SSR hydration safety of the scenario list", () => {
    // These use raw `react-dom/client` (not React Testing Library's `render`,
    // which wraps mounting in `act()` and so flushes passive effects
    // synchronously before we get a chance to inspect the pre-effect DOM).
    // Calling `createRoot(...).render()` directly, outside of `act`, mirrors
    // what actually happens in the browser: the initial commit paints before
    // the post-hydration `useEffect` that loads scenarios from localStorage
    // runs. If that first render ever reads localStorage directly (as the
    // old lazy `useState(loadScenarios)` initializer did), it would produce
    // different output there than a real server render (which always sees
    // `[]`, since `window`/`localStorage` don't exist during prerendering) —
    // a hydration mismatch. Asserting the pre-effect render is always `[]`
    // is the closest this jsdom-based suite can get to proving that without
    // an actual server/client render diff.
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    afterEach(() => {
      act(() => root.unmount());
      container.remove();
    });

    it("renders the empty state on the very first (pre-effect) commit even when scenarios are already saved", async () => {
      // Seed localStorage *before* mounting, so a client-only initializer
      // reading it directly (the bug) would show up on the first paint.
      addScenario({
        lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
        annualReturn: 12, years: 15, inflationPct: 6, name: "Pre-existing",
      });
      expect(loadScenarios()).toHaveLength(1);

      root = createRoot(container);
      // `flushSync` forces the initial render to commit synchronously
      // (React 18+ would otherwise schedule even a first mount
      // asynchronously outside of `act`), but — unlike `act()` — it does
      // not also flush passive effects. That leaves us a window to inspect
      // the DOM after the commit but before the post-hydration `useEffect`
      // that loads scenarios from localStorage runs.
      flushSync(() => root.render(<CalculatorTab />));

      // First paint must match what a server render would have produced:
      // no saved scenarios, because SSR never sees localStorage.
      expect(container.textContent).toContain("No saved scenarios yet.");
      expect(container.textContent).not.toContain("Pre-existing");

      // After effects flush (post-hydration), the real saved scenario shows up.
      await act(async () => {});
      expect(container.textContent).toContain("Pre-existing");
      expect(container.textContent).not.toContain("No saved scenarios yet.");
    });
  });
});

describe("CalculatorTab validation", () => {
  it("replaces the results with a summary instead of computing on an empty field", () => {
    render(<CalculatorTab />);
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: "" } });

    expect(screen.queryByText(/future value/i)).not.toBeInTheDocument();
    // Two alerts are expected: the inline message on the field itself, and
    // this labelled line in the summary that took the results' place.
    expect(screen.getByText(/Duration \(years\): Enter a number/)).toBeInTheDocument();
  });

  it("flags an out-of-range field inline and names it in the summary", () => {
    render(<CalculatorTab />);
    fireEvent.change(screen.getByLabelText(/expected annual return/i), { target: { value: "150" } });

    const input = screen.getByLabelText(/expected annual return/i);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText(/Expected annual return: Must be at most 100/)).toBeInTheDocument();
  });

  it("refuses to save a scenario built from invalid inputs", () => {
    render(<CalculatorTab />);
    fireEvent.change(screen.getByLabelText(/scenario name/i), { target: { value: "Broken" } });
    fireEvent.change(screen.getByLabelText(/duration/i), { target: { value: "0" } });

    const save = screen.getByRole("button", { name: /save scenario/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(loadScenarios()).toHaveLength(0);
  });

  it("recovers once the field is valid again", () => {
    render(<CalculatorTab />);
    const years = screen.getByLabelText(/duration/i);
    fireEvent.change(years, { target: { value: "" } });
    expect(screen.queryByText(/future value/i)).not.toBeInTheDocument();

    fireEvent.change(years, { target: { value: "20" } });
    expect(screen.getByText(/future value/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
