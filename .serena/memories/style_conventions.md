# Style & Conventions
- TypeScript with strict mode and ESM; prefer 2-space indentation, concise imports, single-purpose modules. Paths use aliases from `vite.config.ts` (`@`, `@shared`, `@assets`).
- React: functional components in PascalCase files; hooks start with `use` and live under `client/src/hooks`; co-locate component styles and use Tailwind utilities; keep globals in `client/src/index.css` minimal.
- Server: camelCase utilities; keep request logging terse (see `server/app.ts`); centralize DB access via `storage` and schemas in `shared/schema.ts`.
- Validation: rely on Zod schemas from `shared/schema.ts`; keep API responses small and avoid logging secrets.
- Internationalization: responses are Portuguese by default in chat route; maintain that unless specified.
- Env handling: throw early when required env vars are missing (e.g., `DATABASE_URL`, `OPENROUTER_API_KEY`); avoid committing `.env`.