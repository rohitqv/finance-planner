"use client";
import { useEffect, useMemo, useState } from "react";
import InputPanel from "./InputPanel";
import ResultCards from "./ResultCards";
import GrowthChart from "./GrowthChart";
import ScenarioTable from "./ScenarioTable";
import { calculate, calculateSeries } from "@/lib/finance/calculate";
import type { CalculatorInput } from "@/lib/finance/types";
import {
  addScenario, deleteScenario, duplicateScenario, loadScenarios, type Scenario,
} from "@/store/scenarios";

const DEFAULT: CalculatorInput = {
  lumpsum: 0, monthlySip: 10000, stepUpPct: 0,
  annualReturn: 12, years: 15, inflationPct: 6,
};

export default function CalculatorTab({ initial }: { initial?: Partial<CalculatorInput> & { corpusGoal?: number } } = {}) {
  const [input, setInput] = useState<CalculatorInput>({ ...DEFAULT, ...initial });
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<number | undefined>(initial?.corpusGoal);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  useEffect(() => setScenarios(loadScenarios()), []);
  useEffect(() => { if (initial) setInput({ ...DEFAULT, ...initial }); setGoal(initial?.corpusGoal); }, [initial]);

  const result = useMemo(() => calculate(input), [input]);
  const series = useMemo(() => calculateSeries(input), [input]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <InputPanel value={input} onChange={setInput} />
        <div className="mt-4 flex gap-2">
          <input
            aria-label="Scenario name"
            className="flex-1 rounded border px-3 py-2"
            placeholder="Scenario name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white"
            onClick={() => {
              if (!name.trim()) return;
              setScenarios(addScenario({ ...input, name: name.trim(), corpusGoal: goal }));
              setName("");
            }}
          >
            Save scenario
          </button>
        </div>
      </div>
      <div className="space-y-4">
        <ResultCards result={result} />
        <GrowthChart series={series} goal={goal} />
      </div>
      <div className="md:col-span-2">
        <h3 className="mb-2 font-semibold">Saved scenarios</h3>
        <ScenarioTable
          scenarios={scenarios}
          onDelete={(id) => setScenarios(deleteScenario(id))}
          onDuplicate={(id) => setScenarios(duplicateScenario(id))}
          onLoad={(s) => { setInput(s); setGoal(s.corpusGoal); }}
        />
      </div>
    </div>
  );
}
