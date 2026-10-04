import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests only: `__tests__/` folders beside the code they test. Fast, no
// network. This app has no database, so there is no integration suite.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, ".") } },
  test: {
    environment: "node",
    include: ["**/__tests__/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/.claude/worktrees/**", "**/.worktrees/**"],
  },
});
