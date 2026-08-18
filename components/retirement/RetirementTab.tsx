"use client";
import { useEffect, useMemo, useState } from "react";
import RetirementInputs from "./RetirementInputs";
import PhaseEditor from "./PhaseEditor";
import RetirementResults from "./RetirementResults";
import DrawdownTable from "./DrawdownTable";
import DrawdownChart from "./DrawdownChart";
import RetirementAgeCompare from "./RetirementAgeCompare";
import AccumulationChart from "./AccumulationChart";
import AccumulationTable from "./AccumulationTable";
import { computeRetirement, computeAccumulationSplit, includedCorpusAmount, DEFAULT_ASSET_CLASSES, type RetirementInput } from "@/lib/finance/retirement";
import { loadPlan, savePlan } from "@/store/retirementPlan";

const DEFAULT: RetirementInput = {
  currentAge: 30, retirementAge: 55, lifespanAge: 85,
  currentMonthlyExpense: 50000, inflationPct: 6, preReturnPct: 12, postReturnPct: 8,
  phases: [], assetClasses: DEFAULT_ASSET_CLASSES, currentMonthlyInvestment: 0,
  useBucketStrategy: false, bucketYears: 5, safeBucketRatePct: 7, growthBucketRatePct: 11,
};

export type RetirementHandoff = {
  monthlySip: number;
  lumpsum: number;
  years: number;
  corpusGoal: number;
  annualReturn: number;
  inflationPct: number;
};

export default function RetirementTab({
  onHandoff,
}: { onHandoff?: (p: RetirementHandoff) => void }) {
  // Lazy initializer avoids a mount-time setState-in-effect (and the load/save
  // race that came with it): the saved plan (if any) is read synchronously
  // while computing the initial state, so there's no render where `input`
  // holds DEFAULT before the loaded value lands.
  const [input, setInput] = useState<RetirementInput>(() => loadPlan() ?? DEFAULT);
  useEffect(() => { savePlan(input); }, [input]);

  const result = useMemo(() => computeRetirement(input), [input]);
  const split = useMemo(
    () => computeAccumulationSplit(input, result.requiredMonthlySip),
    [input, result.requiredMonthlySip],
  );

  // Guard the handoff at the source: requiredMonthlySip can be an
  // intentional Infinity (see lib/finance/retirement.ts) when there's no
  // time left to accumulate via SIP, and corpusNeededAtRetirement/SIP both
  // collapse to a silent 0 when lifespanAge <= retirementAge (Finding 5).
  // Neither should ever reach the Calculator tab.
  const invalidLifespan = input.lifespanAge <= input.retirementAge;
  const canHandoff =
    input.retirementAge > input.currentAge &&
    !invalidLifespan &&
    Number.isFinite(result.requiredMonthlySip);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <RetirementInputs value={input} onChange={setInput} />
        <PhaseEditor phases={input.phases} onChange={(phases) => setInput({ ...input, phases })} />
      </div>
      <div className="space-y-4">
        <RetirementResults result={result} invalidLifespan={invalidLifespan} />
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canHandoff}
          title={
            canHandoff
              ? undefined
              : "Set a retirement age greater than current age and a lifespan greater than retirement age first."
          }
          onClick={() => {
            if (!canHandoff) return;
            onHandoff?.({
              monthlySip: Math.round(result.requiredMonthlySip),
              lumpsum: includedCorpusAmount(input.assetClasses),
              years: input.retirementAge - input.currentAge,
              corpusGoal: Math.round(result.corpusNeededAtRetirement),
              annualReturn: input.preReturnPct,
              inflationPct: input.inflationPct,
            });
          }}
        >
          Plan this in Calculator
        </button>
        <p className="text-xs text-gray-500">
          Uses only the asset classes counted toward retirement (see checkboxes
          above), grown at the return on monthly investment rate above — not
          each asset class&apos;s own rate.
        </p>
        <DrawdownChart rows={result.drawdown} />
      </div>
      <div className="md:col-span-2">
        {split.required.length > 0 ? (
          <div className="mb-6">
            <h3 className="mb-2 font-semibold">
              Growing to retirement{split.surplus ? " — required vs. surplus" : ""}
            </h3>
            <AccumulationChart required={split.required} surplus={split.surplus} startAge={input.currentAge} />
            <AccumulationTable required={split.required} surplus={split.surplus} startAge={input.currentAge} />
          </div>
        ) : null}
        <h3 className="mb-2 font-semibold">Year-by-year drawdown</h3>
        <DrawdownTable rows={result.drawdown} />
        <div className="mt-6">
          <h3 className="mb-2 font-semibold">Compare retirement ages</h3>
          <RetirementAgeCompare base={input} ages={[input.retirementAge - 5, input.retirementAge, input.retirementAge + 5]} />
        </div>
      </div>
    </div>
  );
}
