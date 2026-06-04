import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@fixtures": fileURLToPath(new URL("./fixtures", import.meta.url)),
      "@keiba-ai-assistant/web": fileURLToPath(new URL("./apps/web/src", import.meta.url))
    }
  },
  test: {
    exclude: ["node_modules/**", "dist/**", "data/**", "runs/**"],
    globals: false,
    include: [
      "apps/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.tsx",
      "packages/*/src/**/*.test.ts",
      "packages/*/src/**/*.test.tsx"
    ]
  }
});
