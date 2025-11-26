# Task Completion Checklist
- Run `npm run check` to ensure TypeScript types pass; if relevant, run `npm run build` to confirm bundling succeeds.
- For schema changes, execute `npm run db:push` against the target DATABASE_URL and mention migrations in notes/PR.
- Verify `.env` has required keys (`DATABASE_URL`, `OPENROUTER_API_KEY`, optional `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`, `PORT`), but do not commit secrets.
- If UI changes occur, capture a quick screenshot/GIF for PR context.
- Note that there is no automated test suite yet; document any manual checks performed.
- Summarize changes and risks; follow Conventional Commit prefixes if committing locally.