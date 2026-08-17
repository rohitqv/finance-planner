import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { createRoot, type Root } from "react-dom/client";
import { flushSync } from "react-dom";
import BackupRestore from "@/components/BackupRestore";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import { loadScenarios, saveScenarios } from "@/store/scenarios";
import { DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";
import type { Scenario } from "@/store/scenarios";

const plan: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
};

const scenario: Scenario = {
  id: "s1", name: "Base case", lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6, createdAt: 1000,
};

let reloadMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  localStorage.clear();
  reloadMock = vi.fn();
  Object.defineProperty(window, "location", {
    value: { ...window.location, reload: reloadMock },
    writable: true,
  });
  global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
  // jsdom doesn't implement the `download` attribute or blob-URL navigation:
  // clicking the export component's <a href="blob:..."> triggers a real
  // "navigate to another document" attempt, which jsdom logs as "Not
  // implemented: navigation to another Document" (harmless, but noisy).
  // Stub the click so the test still verifies createObjectURL was called
  // with the right blob without jsdom attempting real navigation.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

function backupFile(payload: unknown, name = "backup.json"): File {
  return new File([JSON.stringify(payload)], name, { type: "application/json" });
}

describe("BackupRestore", () => {
  it("disables Export when nothing is saved", () => {
    render(<BackupRestore />);
    expect(screen.getByRole("button", { name: /export data/i })).toBeDisabled();
  });

  it("enables Export and checks both boxes by default once a plan and scenarios exist", () => {
    savePlan(plan);
    saveScenarios([scenario]);
    render(<BackupRestore />);
    expect(screen.getByRole("button", { name: /export data/i })).toBeEnabled();
    expect(screen.getByLabelText(/include retirement plan/i)).toBeChecked();
    expect(screen.getByLabelText(/include saved scenarios/i)).toBeChecked();
  });

  it("exports a JSON blob containing the checked data", async () => {
    savePlan(plan);
    saveScenarios([scenario]);
    render(<BackupRestore />);

    const createObjectURL = global.URL.createObjectURL as ReturnType<typeof vi.fn>;
    fireEvent.click(screen.getByRole("button", { name: /export data/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const parsed = JSON.parse(await blob.text());
    expect(parsed.version).toBe(1);
    expect(parsed.retirementPlan).toEqual(plan);
    expect(parsed.scenarios).toEqual([scenario]);
  });

  it("shows an error and saves nothing when the imported file is invalid", async () => {
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [backupFile({ not: "a backup" })] } });

    await waitFor(() => {
      expect(screen.getByText(/doesn't look like a finance planner backup/i)).toBeInTheDocument();
    });
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("imports scenarios without confirmation and merges with fresh ids", async () => {
    saveScenarios([scenario]);
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    const confirmSpy = vi.spyOn(window, "confirm");

    fireEvent.change(input, {
      target: {
        files: [backupFile({
          version: 1, exportedAt: "2026-01-01T00:00:00.000Z",
          scenarios: [{ ...scenario, id: "imported-1", name: "Imported" }],
        })],
      },
    });

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();

    const stored = loadScenarios();
    expect(stored).toHaveLength(2);
    expect(stored.some((s) => s.name === "Imported" && s.id !== "imported-1")).toBe(true);
  });

  it("imports a plan directly (no confirm) when no plan is currently saved", async () => {
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    const confirmSpy = vi.spyOn(window, "confirm");

    fireEvent.change(input, {
      target: { files: [backupFile({ version: 1, exportedAt: "2026-01-01T00:00:00.000Z", retirementPlan: plan })] },
    });

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(loadPlan()).toEqual(plan);
  });

  it("asks for confirmation before overwriting an existing plan, and skips the write when cancelled", async () => {
    savePlan({ ...plan, currentAge: 40 });
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    fireEvent.change(input, {
      target: { files: [backupFile({ version: 1, exportedAt: "2026-01-01T00:00:00.000Z", retirementPlan: plan })] },
    });

    await waitFor(() => expect(confirmSpy).toHaveBeenCalledTimes(1));
    expect(reloadMock).not.toHaveBeenCalled();
    expect(loadPlan()?.currentAge).toBe(40); // unchanged
  });

  it("overwrites the plan when confirmed", async () => {
    savePlan({ ...plan, currentAge: 40 });
    render(<BackupRestore />);
    const input = screen.getByLabelText(/import backup file/i) as HTMLInputElement;
    vi.spyOn(window, "confirm").mockReturnValue(true);

    fireEvent.change(input, {
      target: { files: [backupFile({ version: 1, exportedAt: "2026-01-01T00:00:00.000Z", retirementPlan: plan })] },
    });

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(loadPlan()?.currentAge).toBe(30);
  });

  describe("SSR hydration safety", () => {
    // Mirrors the equivalent test in components/calculator/__tests__/CalculatorTab.test.tsx.
    // React Testing Library's `render()` wraps mounting in `act()`, which
    // flushes passive effects synchronously — so it can't observe the
    // pre-effect commit. Using raw `react-dom/client` with `flushSync`
    // (which commits the initial render but does NOT flush passive effects)
    // mirrors what a real browser does: paint first, run the post-hydration
    // `useEffect` after. If that first render ever read localStorage
    // directly, it would show checked/enabled controls here that a real
    // server render (no `window`/`localStorage`) could never have produced —
    // a hydration mismatch.
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

    it("renders Export disabled on the very first (pre-effect) commit even when a plan and scenarios are already saved", async () => {
      savePlan(plan);
      saveScenarios([scenario]);

      root = createRoot(container);
      flushSync(() => root.render(<BackupRestore />));

      // First paint must match what a server render would have produced:
      // nothing saved, because SSR never sees localStorage.
      const exportButton = container.querySelector("button");
      expect(exportButton?.textContent).toMatch(/export data/i);
      expect(exportButton).toBeDisabled();

      // After effects flush (post-hydration), the real saved data shows up.
      await act(async () => {});
      expect(exportButton).toBeEnabled();
    });
  });
});
