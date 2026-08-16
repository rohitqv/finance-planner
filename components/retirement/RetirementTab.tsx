"use client";
import { useEffect, useMemo, useState } from "react";
import RetirementInputs from "./RetirementInputs";
import PhaseEditor from "./PhaseEditor";
import RetirementResults from "./RetirementResults";
import DrawdownTable from "./DrawdownTable";
import DrawdownChart from "./DrawdownChart";
import { computeRetirement, type RetirementInput } from "@/lib/finance/retirement";
import { loadPlan, savePlan } from "@/store/retirementPlan";

const DEFAULT: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], currentCorpus: 0, currentMonthlyInvestment: 0,
};

export default function RetirementTab({
  onHandoff,
}: { onHandoff?: (p: { monthlySip: number; lumpsum: number; years: number; corpusGoal: number }) => void }) {
  const [input, setInput] = useState<RetirementInput>(DEFAULT);
  useEffect(() => { const p = loadPlan(); if (p) setInput(p); }, []);
  useEffect(() => { savePlan(input); }, [input]);

  const result = useMemo(() => computeRetirement(input), [input]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <RetirementInputs value={input} onChange={setInput} />
        <PhaseEditor phases={input.phases} onChange={(phases) => setInput({ ...input, phases })} />
      </div>
      <div className="space-y-4">
        <RetirementResults result={result} />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white"
          onClick={() =>
            onHandoff?.({
              monthlySip: Math.round(result.requiredMonthlySip),
              lumpsum: input.currentCorpus,
              years: input.retirementAge - input.currentAge,
              corpusGoal: Math.round(result.corpusNeededAtRetirement),
            })
          }
        >
          Plan this in Calculator
        </button>
        <DrawdownChart rows={result.drawdown} />
      </div>
      <div className="md:col-span-2">
        <h3 className="mb-2 font-semibold">Year-by-year drawdown</h3>
        <DrawdownTable rows={result.drawdown} />
      </div>
    </div>
  );
}
