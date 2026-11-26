import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tools/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts", "tools/**/*.ts"],
      // Command-line entry files only parse arguments and print; their logic is in tested modules.
      exclude: ["**/*.test.ts", "tools/**/cli.ts"],
      reporter: ["text-summary"],
      thresholds: { lines: 85, branches: 85, functions: 85, statements: 85 },
    },
  },
});
