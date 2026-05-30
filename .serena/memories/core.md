# Core

- Project: `keiba-ai-assistant`; local-only private horse-racing prediction assistant.
- Current repo is still planning/scaffold stage: `README.md`, `AGENTS.md`, `.serena/` exist; app packages may not exist yet.
- README should stay broad and shallow: product/spec overview only. Detailed technical policy belongs in `AGENTS.md` and Serena memories.
- Planned source map:
  - `apps/web`: local Hono/Inertia/React browser app for race reports and follow-up questions.
  - `apps/cli`: local command entrypoints for serve/collect/analyze/ask.
  - `packages/models`: shared Zod schemas and TypeScript models; no side effects.
  - `packages/scraper`: browser-driven netKeiba/weather collection and structuring; no persistence.
  - `packages/ai`: Codex SDK prompts, race analysis, race Q&A; no persistence.
  - `packages/storage`: `runs/` and `data/` persistence helpers.
  - `policies/main.md`: user prediction policy.
- Data/output invariants:
  - `runs/<race-id>/`: `race.json`, `prediction.json`, `qa.jsonl`, `thread.json`, `metadata.json`.
  - `data/`: cache/browser temporary data.
  - `runs/` and `data/` contents are not committed except optional `.gitkeep`.
- Read for implementation detail: `mem:tech_stack`, `mem:conventions`.
- Read before running commands or finishing tasks: `mem:suggested_commands`, `mem:task_completion`.