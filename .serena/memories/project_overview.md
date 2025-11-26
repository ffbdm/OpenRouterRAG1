# OpenRouterRAG Overview
- Purpose: FAQ chat that routes user questions through OpenRouter; can query a Postgres FAQ table via Drizzle before composing answers.
- Stack: TypeScript (strict, ESM), Express server, React + Vite + Tailwind client, Drizzle ORM + Neon Postgres, Zod shared schemas.
- Layout: `server/` (Express entrypoints, routes, db/storage), `client/src/` (React SPA components/pages/hooks), `shared/schema.ts` (Drizzle + Zod), `dist/public` (built client for prod server), `attached_assets/` (static assets), configs in root (`vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `drizzle.config.ts`).
- Behavior: `/api/chat` logs requests, defines a tool for FAQ search, optionally calls `storage.searchFaqs`, and makes two OpenRouter completions to reply in Portuguese with debug info on DB usage.
- Env: needs `DATABASE_URL` and `OPENROUTER_API_KEY`; optional `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`, `PORT` (default 3000).