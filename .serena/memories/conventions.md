# Conventions

- Always respond in Japanese for this repo.
- If the user prompt ends like `教えて`, `確認して`, or asks only for information, do not edit files; answer findings only unless intent is ambiguous.
- Before editing any existing file, reread that file in the current turn.
- Because `.serena/` exists, use Serena MCP for code reference/modification where applicable, especially symbol search, overview, and symbol replacement.
- Keep README product-facing and shallow; keep technical/implementation policy in `AGENTS.md` and memories.
- Package dependency boundaries:
  - `packages/models` must not depend on other workspace packages and must not do I/O, browser automation, Codex calls, Hono, or React.
  - `packages/scraper`, `packages/ai`, `packages/storage` may depend on `packages/models`.
  - `apps/web` and `apps/cli` may depend on `packages/*`.
  - `packages/*` must not depend on `apps/*`.
- Keep persistence out of `packages/scraper` and `packages/ai`; route it through `packages/storage`.
- Do not add public deployment, multi-user auth, or features that break local-private-use assumptions.
- Never implement shortcuts that bypass netKeiba access controls. Stop on communication limits, warning pages, CAPTCHA, abnormal responses, login/paywall/access restrictions.
- Do not commit or publish real netKeiba-derived data, generated real-race reports, HTML/images/screenshots, reproduced race-card data, browser sessions, cookies, credentials, or `.env`.