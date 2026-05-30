# Suggested Commands

- Repo is currently not fully scaffolded; verify `package.json` before assuming pnpm scripts exist.
- Dependency install after scaffold: `pnpm install`.
- Expected local app/CLI commands once implemented:
  - `keiba-ai-assistant serve`
  - `keiba-ai-assistant collect --race-url <url>`
  - `keiba-ai-assistant analyze --race-id <race-id>`
  - `keiba-ai-assistant ask --race-id <race-id> <question>`
- Expected quality commands once scripts are added:
  - `pnpm typecheck`
  - `pnpm oxlint`
- Serena memory sanity check from repo root: `serena memories check`.
- Darwin shell is zsh. Use `rg` / `rg --files` for search and file discovery.