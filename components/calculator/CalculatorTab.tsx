"use client";
import { useEffect, useMemo, useState } from "react";
import InputPanel from "./InputPanel";
import ResultCards from "./ResultCards";
import GrowthChart from "./GrowthChart";
import ScenarioTable from "./ScenarioTable";
import { calculate, calculateSeries } from "@/lib/finance/calculate";
import type { CalculatorInput } from "@/lib/finance/types";
import {
  addScenario, deleteScenario, duplicateScenario, loadScenarios, updateScenario, type Scenario,
} from "@/store/scenarios";

const DEFAULT: CalculatorInput = {
  lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6,
};

// `initial` crosses an external prop boundary (it's the retirement-handoff
// payload, ultimately built from `Number(...)` on user-editable form fields
// upstream). Only accept finite numbers for each CalculatorInput field;
// anything else (Infinity, NaN, missing) falls back to DEFAULT rather than
// leaking into a <input type="number"> value or downstream FV/CAGR math.
function sanitizeInitial(initial?: Partial<CalculatorInput>): Partial<CalculatorInput> {
  const out: Partial<CalculatorInput> = {};
  if (!initial) return out;
  for (const key of Object.keys(DEFAULT) as (keyof CalculatorInput)[]) {
    const v = initial[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      out[key] = v;
    }
  }
  return out;
}

// `corpusGoal` isn't part of `CalculatorInput`, so it doesn't go through
// `sanitizeInitial` above — but it crosses the same external prop boundary
// (the retirement handoff) and feeds straight into `GrowthChart`'s `goal`
// line, so it needs the same finiteness guard.
function sanitizeGoal(goal?: number): number | undefined {
  return typeof goal === "number" && Number.isFinite(goal) ? goal : undefined;
}

export default function CalculatorTab({ initial }: { initial?: Partial<CalculatorInput> & { corpusGoal?: number } } = {}) {
  // Lazy initializers read the handoff prop / localStorage synchronously
  // while computing the first render's state, instead of via a mount-time
  // `useEffect(() => setState(...), [])`. `initial` only ever changes when
  // this whole component remounts (app/page.tsx renders CalculatorTab or
  // RetirementTab, never both, so switching tabs is a full unmount/mount),
  // so a prop-sync effect isn't needed to react to a changing `initial`
  // after mount.
  const [input, setInput] = useState<CalculatorInput>(() => ({ ...DEFAULT, ...sanitizeInitial(initial) }));
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<number | undefined>(sanitizeGoal(initial?.corpusGoal));
  // Unlike `input`/`goal` above, `scenarios` can't use a lazy initializer:
  // `loadScenarios()` reads localStorage, which is unavailable during SSR
  // (it guards `typeof window` and returns `[]` there). If the initializer
  // called it directly, the server-rendered HTML (always `[]`) would diverge
  // from the client's hydration render (real saved scenarios) whenever a
  // returning user has any saved — a hydration mismatch. So the initial
  // render always starts from `[]` (matching the server), and the real list
  // is loaded after mount, once hydration has already committed.
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration read of localStorage (not a render loop): the client-only data can't be part of the SSR-safe initial render (see comment on `scenarios` above), so it's fetched once here after mount.
    setScenarios(loadScenarios());
  }, []);

  const result = useMemo(() => calculate(input), [input]);
  const series = useMemo(() => calculateSeries(input), [input]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <InputPanel value={input} onChange={setInput} />
        <div className="mt-4 flex gap-2">
          <input
            aria-label="Scenario name"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500"
            placeholder="Scenario name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            onClick={() => {
              if (!name.trim()) return;
              setScenarios(addScenario({ ...input, name: name.trim(), corpusGoal: goal }));
              setName("");
              setSelectedScenarioId(null);
            }}
          >
            Save scenario
          </button>
          {selectedScenarioId && (
            <button
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              onClick={() => {
                const patch: Partial<Scenario> = { ...input, corpusGoal: goal };
                if (name.trim()) patch.name = name.trim();
                setScenarios(updateScenario(selectedScenarioId, patch));
              }}
            >
              Update scenario
            </button>
          )}
        </div>
      </div>
      <div className="space-y-4">
        <ResultCards result={result} />
        <GrowthChart series={series} goal={goal} />
      </div>
      <div className="md:col-span-2">
        <h3 className="mb-2 font-semibold">
          Saved scenarios{scenarios.length > 0 ? ` (${scenarios.length})` : ""}
        </h3>
        <ScenarioTable
          scenarios={scenarios}
          onDelete={(id) => {
            setScenarios(deleteScenario(id));
            if (selectedScenarioId === id) setSelectedScenarioId(null);
          }}
          onDuplicate={(id) => setScenarios(duplicateScenario(id))}
          onLoad={(s) => {
            setInput(s);
            setGoal(s.corpusGoal);
            setName(s.name);
            setSelectedScenarioId(s.id);
          }}
        />
      </div>
    </div>
  );
}
