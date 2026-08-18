"use client";
import { useState } from "react";
import Tabs from "@/components/Tabs";
import CalculatorTab from "@/components/calculator/CalculatorTab";
import RetirementTab from "@/components/retirement/RetirementTab";
import ResourcesTab from "@/components/ResourcesTab";
import BackupRestore from "@/components/BackupRestore";
import ThemeToggle from "@/components/ThemeToggle";
import type { CalculatorInput } from "@/lib/finance/types";

export default function Page() {
  const [active, setActive] = useState(0);
  const [handoff, setHandoff] = useState<(Partial<CalculatorInput> & { corpusGoal?: number }) | undefined>();

  return (
    <main className="mx-auto max-w-5xl p-6">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Finance Planner</h1>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <BackupRestore />
        </div>
      </header>
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
