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
import SectionNav from "./SectionNav";
import DrawdownViewToggle, { type DrawdownView } from "./DrawdownViewToggle";
import { computeRetirement, computeAccumulationSplit, includedCorpusAmount, type RetirementInput } from "@/lib/finance/retirement";
import { loadPlan, savePlan } from "@/store/retirementPlan";
import { DEFAULT_RETIREMENT_INPUT } from "@/lib/finance/defaults";
import InfoTip from "@/components/InfoTip";
import ValidationSummary from "@/components/ui/ValidationSummary";
import {
  RETIREMENT_FIELD_SPECS, summarizeValidation, validateRetirementInput,
} from "@/lib/finance/validation";

export type RetirementHandoff = {
  monthlySip: number;
  lumpsum: number;
  years: number;
  corpusGoal: number;
  annualReturn: number;
  inflationPct: number;
  stepUpPct: number;
};

export default function RetirementTab({
  onHandoff,
}: { onHandoff?: (p: RetirementHandoff) => void }) {
  // Lazy initializer avoids a mount-time setState-in-effect (and the load/save
  // race that came with it): the saved plan (if any) is read synchronously
  // while computing the initial state, so there's no render where `input`
  // holds DEFAULT before the loaded value lands.
  const [input, setInput] = useState<RetirementInput>(() => loadPlan() ?? DEFAULT_RETIREMENT_INPUT);
  useEffect(() => { savePlan(input); }, [input]);

  // Which corpus the drawdown chart and table describe. Defaults to the
  // user's own projection: "does my money last?" is the question they came
  // with, and the required-corpus curve can only ever answer "yes".
  const [drawdownView, setDrawdownView] = useState<DrawdownView>("projected");

  // Validation gates the math: computeRetirement on an out-of-range or
  // half-typed input returns figures (a silent ₹0 corpus, an Infinity SIP)
  // that look like answers but aren't. The age-ordering checks this replaces
  // used to live here as one-off booleans; they're now part of the shared
  // validator alongside the bounds checks.
  const validation = useMemo(() => validateRetirementInput(input), [input]);
  const problems = useMemo(
    () => summarizeValidation(validation, RETIREMENT_FIELD_SPECS),
    [validation],
  );
  const result = useMemo(
    () => (validation.ok ? computeRetirement(input) : null),
    [input, validation.ok],
  );
  const split = useMemo(
    () => (result ? computeAccumulationSplit(input, result.requiredMonthlySip) : { required: [], surplus: null }),
    [input, result],
  );

  // requiredMonthlySip can still be an intentional Infinity even on a valid
  // plan (see lib/finance/retirement.ts), and that must never reach the
  // Calculator tab.
  const canHandoff = !!result && Number.isFinite(result.requiredMonthlySip);

  const drawdownRows = result
    ? (drawdownView === "required" ? result.drawdown : result.projectedDrawdown)
    : [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-4">
        <RetirementInputs value={input} onChange={setInput} errors={validation.fields} />
        <PhaseEditor phases={input.phases} onChange={(phases) => setInput({ ...input, phases })} />
      </div>
      <div id="results" className="scroll-mt-16 space-y-4">
        {result ? (
        <RetirementResults
          result={result}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    stepUpPct: input.sipStepUpPct,
                  });
                }}
              >
                Plan this in Calculator
              </button>
              <InfoTip
                label="About the handoff calculation"
                text="Uses only the asset classes counted toward retirement (see checkboxes above), grown at the return on monthly investment rate above — not each asset class's own rate."
              />
            </div>
          }
        />
        ) : (
          <ValidationSummary messages={problems} />
        )}
        {result ? (
          <div className="space-y-2">
            <DrawdownViewToggle
              view={drawdownView}
              onChange={setDrawdownView}
              depletionAge={result.projectedDepletionAge}
              lifespanAge={input.lifespanAge}
            />
            <DrawdownChart rows={drawdownRows} />
          </div>
        ) : null}
      </div>
      <div className="md:col-span-2">
        <SectionNav
          items={[
            { id: "results", label: "Results" },
            ...(split.required.length > 0 ? [{ id: "growth", label: "Growth to retirement" }] : []),
            ...(result ? [{ id: "yearly", label: "Year-by-year" }] : []),
            ...(result ? [{ id: "compare", label: "Compare ages" }] : []),
          ]}
        />
        {split.required.length > 0 ? (
          <div id="growth" className="mb-6 scroll-mt-16">
            <h3 className="mb-2 font-semibold">
              Growing to retirement{split.surplus ? " — required vs. surplus" : ""}
            </h3>
            <AccumulationChart required={split.required} surplus={split.surplus} startAge={input.currentAge} />
            <AccumulationTable required={split.required} surplus={split.surplus} startAge={input.currentAge} />
          </div>
        ) : null}
        {result ? (
          <>
            <div id="yearly" className="scroll-mt-16">
              <h3 className="mb-2 font-semibold">
                Year-by-year drawdown
                {drawdownView === "projected" ? " — your projection" : " — required corpus"}
              </h3>
              <DrawdownTable rows={drawdownRows} />
            </div>
            <div id="compare" className="mt-6 scroll-mt-16">
              <h3 className="mb-2 font-semibold">Compare retirement ages</h3>
              <RetirementAgeCompare base={input} ages={[input.retirementAge - 5, input.retirementAge, input.retirementAge + 5]} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
