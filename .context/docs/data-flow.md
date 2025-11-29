<!-- agent-update:start:data-flow -->
# Data Flow & Integrations

Explain how data enters, moves through, and exits the system, including interactions with external services.

## High-level Flow
1. The React SPA collects a Portuguese prompt and sends `POST /api/chat { message }`.
2. Express logs the request, optionally forces the catalog tool based on keywords, and calls OpenRouter with the tool schema attached.
3. When OpenRouter responds with tool calls, the server executes `searchFaqs` or `searchCatalog` via Drizzle and appends the structured results as system messages.
4. A second OpenRouter call receives the enriched message history and returns the final answer.
5. Express persists no state—responses plus debug metadata stream back to the SPA while SSE broadcasts log entries to the in-app terminal.

## Internal Movement
- **Client → Server:** `client/src/pages/chat.tsx` uses `apiRequest` (React Query) to call the API and listens to `/api/logs/stream` via `LogTerminal`.
- **Server orchestration:** `server/routes.ts` constructs OpenRouter payloads, inspects tool calls, and emits debug payloads; `server/app.ts` injects middleware for timing/log truncation.
- **Search helpers:** `server/storage.ts` tokenizes/normalizes queries before running Drizzle `ilike` conditions. All table contracts originate from `shared/schema.ts` to keep inserts, selects, and scripts consistent.
- **Config artifacts:** `plans/` documents retrieval strategies, `drizzle.config.ts` binds schema to migrations, and `vite.config.ts` defines module aliases that keep imports consistent.

## External Integrations
- **OpenRouter (LLM orchestration)** — Authenticated with `OPENROUTER_API_KEY` via Bearer header plus optional referer/title metadata. Payload: Chat Completion request containing Portuguese system prompts and optional `tool_choice`. Retries currently rely on fetch default behavior; errors bubble back to the client with detailed log lines for follow-up.
- **Neon/Postgres (data retrieval)** — `DATABASE_URL` drives pooled WebSocket connections via `@neondatabase/serverless`. Drizzle issues parameterized SQL for FAQs and catalog tables. Search FALLBACK uses normalized `ILIKE` expressions; token logging helps troubleshoot misses. If Neon is unreachable, the API responds 500 with details logged via SSE.

## Observability & Failure Modes
- **Structured logging:** `server/app.ts` records method, path, status, duration, and (trimmed) JSON payloads for `/api` calls. Messages exceeding 80 chars are truncated but still broadcast via SSE.
- **In-app terminal:** `/api/logs/stream` replays buffered entries so QA can see OpenRouter payloads, tool invocations, and DB counts without SSH.
- **Tool payload tracing:** `server/routes.ts` usa `logToolPayload` para registrar exatamente qual conteúdo dos resultados das funções (`searchFaqs`, `searchCatalog`) é devolvido para a IA, incluindo argumentos resolvidos e prévias truncadas do contexto enviado.
- **Error surfacing:** Any exception in `/api/chat` emits a 500 with `details` plus a console stack trace. There is no retry/backoff yet; operators should monitor for repeated OpenRouter or Neon failures via the SSE feed.
- **Safeguards:** Catalog queries force tool usage when keywords match, reducing the chance of an LLM hallucination. Future improvements could auto-call `searchFaqs` if the model refuses.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Validate flows against the latest integration contracts or diagrams.
2. Update authentication, scopes, or rate limits when they change.
3. Capture recent incidents or lessons learned that influenced reliability.
4. Link to runbooks or dashboards used during triage.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Architecture diagrams, ADRs, integration playbooks.
- API specs, queue/topic definitions, infrastructure code.
- Postmortems or incident reviews impacting data movement.

<!-- agent-update:end -->
