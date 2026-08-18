"use client";
import { useState } from "react";
import Tabs from "@/components/Tabs";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import RetirementTab from "@/components/retirement/RetirementTab";
import ResourcesTab from "@/components/ResourcesTab";
import BackupRestore from "@/components/BackupRestore";
import type { CalculatorInput } from "@/lib/finance/types";

export default function Page() {
  const [active, setActive] = useState(0);
  const [handoff, setHandoff] = useState<(Partial<CalculatorInput> & { corpusGoal?: number }) | undefined>();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold">Finance Planner</h1>
      <BackupRestore />
      <Tabs tabs={["Investment Calculator", "Retirement Planner", "Resources"]} active={active} onSelect={setActive} />
      {active === 0 ? (
        <CalculatorTab initial={handoff} />
      ) : active === 1 ? (
        <RetirementTab
          onHandoff={(p) => {
            setHandoff({
              lumpsum: p.lumpsum,
              monthlySip: p.monthlySip,
              years: p.years,
              corpusGoal: p.corpusGoal,
              annualReturn: p.annualReturn,
              inflationPct: p.inflationPct,
            });
            setActive(0);
          }}
        />
      ) : (
        <ResourcesTab />
      )}
    </main>
  );
}
