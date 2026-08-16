import { describe, it, expect, beforeEach } from "vitest";
import { addScenario, loadScenarios, updateScenario, deleteScenario, duplicateScenario } from "@/store/scenarios";

beforeEach(() => localStorage.clear());

const draft = {
  name: "Base", lumpsum: 100000, monthlySip: 5000, stepUpPct: 0,
  annualReturn: 12, years: 10, inflationPct: 6,
};

describe("scenario store", () => {
  it("adds and loads scenarios", () => {
    const list = addScenario(draft);
    expect(list).toHaveLength(1);
    expect(loadScenarios()[0].name).toBe("Base");
    expect(loadScenarios()[0].id).toBeTruthy();
  });
  it("updates a scenario", () => {
    const [s] = addScenario(draft);
    const list = updateScenario(s.id, { name: "Renamed" });
    expect(list[0].name).toBe("Renamed");
  });
  it("duplicates a scenario with a new id", () => {
    const [s] = addScenario(draft);
    const list = duplicateScenario(s.id);
    expect(list).toHaveLength(2);
    expect(list[1].id).not.toBe(s.id);
  });
  it("deletes a scenario", () => {
    const [s] = addScenario(draft);
    expect(deleteScenario(s.id)).toHaveLength(0);
  });
});
