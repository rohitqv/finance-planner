import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // `.claude/worktrees/*` are git worktrees for other branches/sessions;
    // their test files are stale copies that would otherwise be picked up
    // by the default include glob and run against THIS branch's source.
    exclude: [...configDefaults.exclude, "**/.claude/**"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
