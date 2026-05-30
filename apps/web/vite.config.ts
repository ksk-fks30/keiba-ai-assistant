import devServer from "@hono/vite-dev-server";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    devServer({
      entry: "src/server/app.ts"
    }),
    react(),
    await babel({
      presets: [reactCompilerPreset()]
    })
  ],
  resolve: {
    tsconfigPaths: true
  },
  server: {
    port: 3000
  },
  build: {
    manifest: true,
    outDir: "dist/client",
    rolldownOptions: {
      input: "src/client.tsx"
    }
  }
});
