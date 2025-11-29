
<!-- agent-update:start:testing-strategy -->
# Testing Strategy

Quality today is enforced through strict TypeScript checks, manual E2E validation in the browser, and targeted logging of AI/tool interactions. Automated Jest/Playwright suites are not yet in place, so contributors must document manual steps inside their PRs until we introduce test scaffolding.

## Test Types
- **Type-level/unit coverage:** `npm run check` runs the repo-wide TypeScript program which catches regressions in shared types, storage contracts, and React props.
- **Manual integration checks:** Run `npm run dev`, submit Portuguese prompts that hit `searchFaqs` and `searchCatalog`, and verify the debug payload plus SSE logs reflect the expected DB counts.
- **Ad-hoc scripts:** `scripts/seedCatalog.ts` and future drizzly scripts double as sanity checks for schema/migration health.
- **Planned automation:** When time allows, add Vitest or Jest for storage utilities and Playwright smoke tests for the chat UI/log terminal.

## Running Tests
- **TypeScript program:** `npm run check`
- **Production bundle sanity:** `npm run build && npm run start`
- **Manual E2E:**
	1. Start dev mode (`npm run dev`).
	2. Open the SPA, send prompts that trigger FAQ and catalog flows.
	3. Watch `/api/logs/stream` via the in-app terminal for tool invocations and errors.
- **Database validation:** Run `npm run tsx scripts/seedCatalog.ts` against a test database and confirm the UI can surface seeded entries.

## Quality Gates
- PRs must pass `npm run check` locally; CI parity will rely on the same command once pipelines are configured.
- Include screenshots or terminal excerpts proving manual test steps (catalog hit counts, OpenRouter errors) when behavior changes.
- Run `npm run build` before merging any change that touches bundler, shared schema, or environment wiring to ensure the esbuild/Vite pipeline stays green.

## Troubleshooting
- **Missing env vars:** If `npm run dev` fails immediately, confirm `DATABASE_URL` and `OPENROUTER_API_KEY` are exported; the server hard-fails when they are absent.
- **Tokenization edge cases:** When `searchFaqs` returns zero rows, inspect the server logs for the normalized tokens to decide whether to adjust the query or seed data.
- **SSE disconnects:** Browser dev tools throttling can pause `/api/logs/stream`; reloading the UI replays buffered logs.
- **Long-running builds:** If `npm run build` stalls, ensure the client bundle was cleaned (`rm -rf dist`) and esbuild is installed (pnpm/npm sometimes skip optional deps).

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Review test scripts and CI workflows to confirm command accuracy.
2. Update Quality Gates with current thresholds (coverage %, lint rules, required checks).
3. Document new test categories or suites introduced since the last update.
4. Record known flaky areas and link to open issues for visibility.
5. Confirm troubleshooting steps remain valid with current tooling.

<!-- agent-readonly:sources -->
## Acceptable Sources
- `package.json` scripts and testing configuration files.
- CI job definitions (GitHub Actions, CircleCI, etc.).
- Issue tracker items labelled “testing” or “flaky” with maintainer confirmation.

<!-- agent-update:end -->
