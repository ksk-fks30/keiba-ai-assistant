# Task Completion

- Docs-only changes: reread changed docs if needed, then inspect `git diff -- README.md AGENTS.md` or relevant paths.
- Implementation changes:
  - Always run `pnpm lint`.
  - Always run `pnpm typecheck`.
  - Run focused tests when test files/scripts exist.
- Frontend/UI changes after scaffold:
  - Start the local dev server and verify in browser when feasible.
  - Check desktop and mobile layouts for text overflow/overlap.
- Data collection changes:
  - Verify rate-limit/cache/stop conditions are preserved.
  - Do not run broad scraping or multi-race collection as a test.
- Before final response, check `git status --short` and report uncommitted relevant changes.
