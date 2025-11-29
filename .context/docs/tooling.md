
<!-- agent-update:start:tooling -->
# Tooling & Productivity Guide

Collect the scripts, automation, and editor settings that keep contributors efficient.

## Required Tooling
- **Node.js 20+ & npm 10+** — Install via nvm or Volta. Required for running Vite, Express, tsx, and esbuild.
- **Postgres access (Neon or local)** — Provision a Neon database or run Postgres locally; populate `DATABASE_URL` for Drizzle + runtime queries.
- **OpenRouter API key** — Request from https://openrouter.ai; export `OPENROUTER_API_KEY` locally and in deployment targets.
- **Drizzle Kit (`npx drizzle-kit ...`)** — Ships in devDependencies; used by `npm run db:push` to sync schema changes.

## Recommended Automation
- Add a git pre-push hook that runs `npm run check` to catch type regressions before CI.
- Use `npm run dev` during feature work; it automatically reloads the SPA and Express routes while mirroring production logging.
- After editing `shared/schema.ts`, run `npm run db:push` followed by `npm run tsx scripts/seedCatalog.ts` to validate migrations plus default data in one loop.
- `tsx` (already installed) can run ad-hoc scripts: `npm run tsx path/to/file.ts` without compiling.

## IDE / Editor Setup
- Enable TypeScript strict mode support (VS Code ships it by default) and point `tsconfig.json` at both client/server so path aliases resolve.
- Install Tailwind, ESLint, and shadcn/ui snippets to speed up component work.
- Configure an HTTP client extension (REST Client, Thunder Client) to hit `/api/chat` with canned payloads for regression tests.
- Use EditorConfig or VS Code settings to enforce 2-space indentation and newline-at-EOF conventions described in `AGENTS.md`.

## Productivity Tips
- Keep a `.env.local` with separate keys for dev vs. demo to avoid rotating secrets after sharing logs.
- Tail `/api/logs/stream` in the browser while also watching the terminal; they expose different truncation levels.
- When debugging OpenRouter payloads, temporarily set `tool_choice` to a specific function to reproduce forced execution paths.
- Capture manual QA steps in your PR body so AI agents can replay them quickly during future regression passes.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Verify commands align with the latest scripts and build tooling.
2. Remove instructions for deprecated tools and add replacements.
3. Highlight automation that saves time during reviews or releases.
4. Cross-link to runbooks or README sections that provide deeper context.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Onboarding docs, internal wikis, and team retrospectives.
- Script directories, package manifests, CI configuration.
- Maintainer recommendations gathered during pairing or code reviews.

<!-- agent-update:end -->
