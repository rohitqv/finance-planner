"use client";
import { useState, type ReactNode } from "react";

export default function TableDisclosure({
  label, children,
}: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span aria-hidden="true" className={`inline-block transition-transform ${open ? "rotate-90" : ""}`}>
          ▸
        </span>
        {label}
      </button>
      {open ? <div className="mt-2">{children}</div> : null}
    </div>
  );
}
