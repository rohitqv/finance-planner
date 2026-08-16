"use client";
import { useState } from "react";
import Tabs from "@/components/Tabs";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import RetirementTab from "@/components/retirement/RetirementTab";
import type { CalculatorInput } from "@/lib/finance/types";

export default function Page() {
  const [active, setActive] = useState(0);
  const [handoff, setHandoff] = useState<(Partial<CalculatorInput> & { corpusGoal?: number }) | undefined>();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Finance Planner</h1>
      <Tabs tabs={["Investment Calculator", "Retirement Planner"]} active={active} onSelect={setActive} />
      {active === 0 ? (
        <CalculatorTab initial={handoff} />
      ) : (
        <RetirementTab
          onHandoff={(p) => {
            setHandoff({ lumpsum: p.lumpsum, monthlySip: p.monthlySip, years: p.years, corpusGoal: p.corpusGoal });
            setActive(0);
          }}
        />
      )}
    </main>
  );
}
