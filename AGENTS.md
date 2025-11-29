# Repository Guidelines

## Project Structure & Module Organization
- `server/` houses the Express entrypoints (`index-dev.ts` for Vite middleware, `index-prod.ts` for static serving), routing (`routes.ts`), and database wiring (`db.ts`, `storage.ts`).
- `client/` is a Vite + React SPA (`src/` for components/pages/hooks, `index.html` for template); build output lands in `dist/public`.
- `shared/schema.ts` defines Drizzle models and Zod schemas shared by server and client; run database migrations after editing.
- Config roots: `vite.config.ts` (aliases `@`, `@shared`, `@assets`), `tailwind.config.ts`, `tsconfig.json`, `drizzle.config.ts`.

## Build, Test, and Development Commands
- `npm run dev` — start Express with Vite middleware for hot reloading (respects `PORT`, defaults 3000).
- `npm run build` — bundle client with Vite and server with esbuild into `dist/`.
- `npm run start` — serve the built app from `dist/index.js` (production path).
- `npm run check` — TypeScript type-check across `client/`, `server/`, `shared/`.
- `npm run db:push` — apply Drizzle schema changes in `shared/schema.ts` to the Postgres database.

## Coding Style & Naming Conventions
- TypeScript, ESM, strict mode; prefer 2-space indentation and single-purpose modules.
- React components use PascalCase filenames; hooks live under `client/src/hooks` and start with `use`.
- Server utilities and routes favor camelCase functions; keep request logging concise as in `server/app.ts`.
- Tailwind for styling; co-locate component-specific styles with components and avoid global overrides outside `client/src/index.css`.
- Use path aliases from `vite.config.ts` (`@/components/Button`, `@shared/schema`).

## Testing Guidelines
- No automated test suite yet; add `*.test.ts` or `*.test.tsx` near source or under `client/src/__tests__` when introducing tests.
- When adding tests, cover route behaviors (OpenRouter calls, FAQ search) and schema validation; keep tests deterministic (mock network and database).

## Commit & Pull Request Guidelines
- Follow Conventional Commits observed in history (`feat: ...`, `chore: ...`).
- PRs should include: summary of changes, affected routes/components, env or DB requirements, and screenshots/GIFs for UI updates.
- If schema changes occur, mention corresponding `npm run db:push` and link to migration notes.

## Environment & Data
- Required env: `DATABASE_URL` (Neon/Postgres), `OPENROUTER_API_KEY`; optional `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`, `PORT`.
- Never log secrets; sample `.env` line: `DATABASE_URL=postgres://user:pass@host/db`.
- Before production deploy, ensure client build exists (`npm run build`) and the server can find `dist/public`.
## AI Context References
- Documentation index: `.context/docs/README.md`
- Agent playbooks: `.context/agents/README.md`

