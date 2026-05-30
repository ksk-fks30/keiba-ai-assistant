# Tech Stack

- Package manager/workspace: pnpm workspace.
- Language: TypeScript 6系.
- Linter: oxlint.
- Web app: Hono + Inertia.js + React; Hono/Inertia bridge: `@hono/inertia`.
- Web rendering model: server-driven SPA via Hono routes returning Inertia pages; avoid API-only sprawl unless needed.
- AI: `@openai/codex-sdk`; AI receives structured data plus `policies/main.md`, not raw pages.
- Browser automation/data collection: Playwright browser operation, not low-level HTTP scraping.
- Validation/modeling: Zod schemas in `packages/models`.
- Persistence: local filesystem under `runs/` and `data/` via `packages/storage`.
- External data source policy:
  - Primary race data source: netKeiba via browser operation.
  - Weather source is separate from netKeiba.
  - Local/private/low-frequency/low-load only.
  - No CAPTCHA/login/paywall/access-limit bypass.