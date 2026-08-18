"use client";
import { useEffect, useState } from "react";

type ThemeMode = "system" | "light" | "dark";
const STORAGE_KEY = "finance-planner:theme";
const ORDER: ThemeMode[] = ["system", "light", "dark"];
const LABEL: Record<ThemeMode, string> = { system: "System", light: "Light", dark: "Dark" };

function applyTheme(mode: ThemeMode) {
  const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export default function ThemeToggle() {
  // Matches app/layout.tsx's inline init script's fallback, so this never
  // disagrees with what's already painted on the page before mount.
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-hydration read of localStorage, mirrors the pattern in BackupRestore.tsx
    setMode(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  useEffect(() => {
    applyTheme(mode);
    if (mode !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  const cycle = () => {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  return (
    <button
      type="button"
      aria-label={`Theme: ${LABEL[mode]}. Click to change.`}
      className="flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3.5 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-gray-500 dark:hover:bg-gray-700"
      onClick={cycle}
    >
      <span aria-hidden="true" className="text-sm leading-none">
        {mode === "system" ? "🖥️" : mode === "light" ? "☀️" : "🌙"}
      </span>
      {LABEL[mode]}
    </button>
  );
}
