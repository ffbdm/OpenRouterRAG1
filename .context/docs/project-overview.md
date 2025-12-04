
<!-- agent-update:start:project-overview -->
# Project Overview

This repository delivers a Retrieval-Augmented Generation (RAG) chat experience for Portuguese-speaking support teams. A React single-page app sends customer prompts to an Express API that orchestrates OpenRouter LLM calls plus Postgres-backed FAQ and catalog searches. The goal is faster, auditable answers for agents who need visibility into what the AI consulted.

## Quick Facts
- Root path: `/Users/fabiofernandes/WorkSpace/OpenRouterRAG`
- Primary code: TypeScript/TSX (React client + Express server), JSON config, Markdown docs
- Persistence: Neon/Postgres via Drizzle ORM; catalog + FAQ tables live in `shared/schema.ts`
- Instructions: tabela `system_instructions` (scopes global/chat/catalog + `order_index`) alimenta o painel da UI; o fluxo do chat consome duas mensagens `system` (`buscar-dados`, `responder-usuario`) antes do prompt do usuário
- AI provider: OpenRouter (`x-ai/grok-4.1-fast:free`) chamado pelo menos uma vez por requisição (auto tools) e uma segunda vez quando dados são recuperados
- Deployment: Vercel-style build (`npm run build`) serving `dist/public` with bundled server entry in `dist/index.js`

## File Structure & Code Organization
- `AGENTS.md` — Repository-wide engineering guidelines (structure, commands, env vars) shared with humans and AI agents.
- `attached_assets/` — Reference copy decks and prompt transcripts used to prime the UI copy or future training runs.
- `client/` — Vite + React SPA (pages, shadcn/ui components, hooks, query client, Tailwind styles, HTML template).
- `client/src/components/InstructionsPanel.tsx` — painel reutilizável que lista/edita instruções por escopo diretamente no Chat e no Catálogo, agora destacando as duas etapas do prompt do chat.
- `client/src/components/MarkdownMessage.tsx` — renderer Markdown sanitizado (remark-gfm + rehype-sanitize) usado na página de chat para exibir respostas do LLM com listas, código e tabelas sem comprometer segurança.
- `components.json` — shadcn/ui generator settings (aliases, tailwind path, preferred style variant).
- `design_guidelines.md` — Product design spec describing typography, layout, and UX constraints for the chat experience.
- `drizzle.config.ts` — Drizzle Kit configuration that maps `shared/schema.ts` to migrations and enforces `DATABASE_URL` presence.
- `package-lock.json` — Deterministic dependency graph; commit whenever npm packages change.
- `package.json` — Scripts (`dev`, `build`, `start`, `check`, `db:push`) and all runtime/dev dependencies.
- `plan-dynamicToolCalls.prompt.md` — Historical plan describing the catalog tool rollout; useful for rationale when editing `server/routes.ts`.
- `plans/` — Additional planning prompts (e.g., FAQ retrieval improvements) that act as lightweight ADRs.
- `postcss.config.js` — PostCSS + Tailwind processing pipeline for the SPA stylesheets.
- `scripts/` — Operational scripts such as `seedCatalog.ts` for populating the catalog table.
- `server/` — Express entrypoints, middleware, routing, OpenRouter orchestration, SSE log streaming, and database storage helpers.
- `shared/` — Cross-layer TypeScript shared assets (Drizzle schema definitions and Zod insert/select helpers).
- `tailwind.config.ts` — Tailwind theme plus plugin setup shared by the SPA build.
- `tsconfig.json` — Strict TypeScript project references covering both client and server.
- `vercel.json` — Production deployment manifest (Vercel-style) that points to `dist/public` and `npm run build`.
- `vite.config.ts` — Frontend bundler config with alias definitions and dev-only Replit plugins.

## Technology Stack Summary
- **Languages & runtimes:** TypeScript across client/server, React 18 SPA, Node.js 20+ on the server, Postgres (Neon) for persistence.
- **AI layer:** OpenRouter's `x-ai/grok-4.1-fast:free` model with function calling to search FAQs or catalog entries.
- **Build & tooling:** Vite for the client, esbuild for the production server bundle, tsx for local TypeScript execution, Tailwind for styling.
- **Data modeling:** Drizzle ORM + Zod schemas em `shared/schema.ts`, agora incluindo `system_instructions` que alimenta o prompt do chat e o painel editável.

## Core Framework Stack
- **Backend:** Express monolith (`server/index-dev.ts`/`index-prod.ts`) with custom middleware for logging, SSE log streaming, and OpenRouter orchestration.
- **Frontend:** Vite + React SPA with shadcn/ui (Radix primitives), React Query for async mutations, and Tailwind utility classes.
- **Data:** Drizzle ORM targeting Neon Postgres; storage methods live in `server/storage.ts` and rely on shared enums/types.
- **Messaging/logging:** Server-sent events push structured logs to the in-app terminal, letting users verify tool invocation without tailing the console.

## UI & Interaction Libraries
- shadcn/ui + Radix UI building blocks standardize inputs, dialogs, and cards.
- Lucide icons, React Hook Form helpers, and `@tanstack/react-query` power the chat form/responses.
- TailwindCSS (plus `tailwind-merge`, `tailwindcss-animate`) enforces spacing/typography rules defined in `design_guidelines.md`.
- `@tailwindcss/typography` + `MarkdownMessage` garantem que mensagens do LLM exibam Markdown rico (GFM) com estilos consistentes e sanitização por padrão.
- The experience is Portuguese-first; keep copy localized and ensure buttons/tooltips remain accessible (ARIA labels, focus styles).

## Development Tools Overview
- `npm run dev` starts Express with Vite middleware and SSE logging; use this for iterative UI/backend tweaks.
- `npm run build && npm run start` replicates the production bundle served from `dist/` (verifies Vercel expectations).
- `npm run check` runs strict TypeScript validation across all packages before merging.
- `npm run db:push` synchronizes schema changes defined in `shared/schema.ts` to Neon/Postgres via Drizzle Kit.
- See [Tooling & Productivity Guide](./tooling.md) for IDE extensions, tsx usage, and Drizzle tips.

## Getting Started Checklist
1. Install dependencies with `npm install` (Node 20+ recommended).
2. Copy `.env.example` (or consult onboarding docs) to provide `DATABASE_URL` and `OPENROUTER_API_KEY` before starting services.
3. Run `npm run dev` to boot Express + Vite, then open `http://localhost:3000` to exercise the chat and log terminal.
4. Seed catalog/FAQ data if needed with `npm run tsx scripts/seedCatalog.ts` (requires populated `.env`).
5. Review [Development Workflow](./development-workflow.md) for branching, review, and release expectations.

## Next Steps
Capture outstanding product questions here—e.g., which vendor owns long-term catalog maintenance, and what SLAs support teams expect for OpenRouter availability.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Review roadmap items or issues labelled “release” to confirm current goals.
2. Cross-check Quick Facts against `package.json` and environment docs.
3. Refresh the File Structure & Code Organization section to reflect new or retired modules; keep guidance actionable.
4. Link critical dashboards, specs, or runbooks used by the team.
5. Flag any details that require human confirmation (e.g., stakeholder ownership).

<!-- agent-readonly:sources -->
## Acceptable Sources
- Recent commits, release notes, or ADRs describing high-level changes.
- Product requirement documents linked from this repository.
- Confirmed statements from maintainers or product leads.

<!-- agent-update:end -->
