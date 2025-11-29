<!-- agent-update:start:development-workflow -->
# Development Workflow

Outline the day-to-day engineering process for this repository.

## Branching & Releases
- Use short-lived feature branches off `main` (`feat/<summary>` or `chore/<summary>`). Rebase before opening a PR to keep diffs small for reviewers (and AI agents).
- `main` is always deployable. Run `npm run build` locally before merging anything that touches bundling, AI prompts, or schema.
- Production deploys mirror Vercel expectations: ship the static bundle in `dist/public` alongside `dist/index.js`. Document any migration/seed requirements in the PR body.
- Tag releases manually if needed (`vYYYY.MM.DD`); include links to updated docs or plans so future readers know where behavior changed.

## Local Development
- Install toolchain: Node 20+, npm 10+, Postgres connection string (Neon or local) plus `OPENROUTER_API_KEY`.
- `npm run dev` starts Express + Vite with SSE log streaming; logs appear both in the terminal and the in-app console.
- `npm run check` performs strict type-checking; run before every PR, especially after editing `shared/schema.ts`.
- `npm run db:push` syncs schema changes; follow up with `npm run tsx scripts/seedCatalog.ts` when catalog defaults matter to your change.
- `npm run build && npm run start` is the smoke test for production parity.

## Code Review Expectations
- Require at least one reviewer (human or approved AI agent) for non-trivial changes; emphasize behavior changes, new prompts, and telemetry updates.
- Include screenshots or terminal captures when you touch the chat UI, SSE terminal, or logging so reviewers can see the impact.
- Call out schema or plan updates explicitly and mention `npm run db:push`/seed requirements in the PR description.
- Reference [AGENTS.md](../../AGENTS.md) for formatting conventions, commit style, and environment reminders.

## Onboarding Tasks
- Read the refreshed guides in `.context/docs` plus `AGENTS.md` to understand expectations.
- Provision a Neon database (or reuse staging), set `DATABASE_URL` + `OPENROUTER_API_KEY`, then run `npm run dev` to ensure both chat and log terminal work.
- Seed FAQs/catalog via `scripts/seedCatalog.ts` so you have realistic data when demoing tool calls.
- Pair with a maintainer on your first PR to learn how we validate OpenRouter payloads and interpret the debug object returned to the UI.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Confirm branching/release steps with CI configuration and recent tags.
2. Verify local commands against `package.json`; ensure flags and scripts still exist.
3. Capture review requirements (approvers, checks) from contributing docs or repository settings.
4. Refresh onboarding links (boards, dashboards) to their latest URLs.
5. Highlight any manual steps that should become automation follow-ups.

<!-- agent-readonly:sources -->
## Acceptable Sources
- CONTRIBUTING guidelines and `AGENTS.md`.
- Build pipelines, branch protection rules, or release scripts.
- Issue tracker boards used for onboarding or triage.

<!-- agent-update:end -->
