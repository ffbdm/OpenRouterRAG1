<!-- agent-update:start:data-flow -->
# Data Flow & Integrations

Explain how data enters, moves through, and exits the system, including interactions with external services.

## High-level Flow
1. The React SPA collects a Portuguese prompt and sends `POST /api/chat { message }`.
2. Express logs the request, optionally forces the catalog tool based on keywords, and calls OpenRouter with the tool schema attached.
3. When OpenRouter responds with tool calls, the server executes `searchFaqs` or `searchCatalog` via Drizzle and appends the structured results as system messages.
4. A second OpenRouter call receives the enriched message history and returns the final answer.
5. Express persists no state—responses plus debug metadata stream back to the SPA while SSE broadcasts log entries to the in-app terminal.
6. The catalog admin page now issues `GET/POST /api/catalog/:id/files` and `DELETE /api/catalog/files/:fileId` to upload/list/remove attachments stored in Vercel Blob; metadata is persisted in Postgres for RAG context.
7. Admins can download the `.xlsx` template via `GET /api/catalog/import/template` and upload batches through `POST /api/catalog/import` (multipart); the backend validates headers/rows, dedupes by nome+fabricante, and inserts in Drizzle chunks inside a transaction.

## Internal Movement
- **Client → Server:** `client/src/pages/chat.tsx` uses `apiRequest` (React Query) to call the API and listens to `/api/logs/stream` via `LogTerminal`. `client/src/pages/catalog.tsx` now manages file uploads and lists with React Query keyed by catalog item ID.
- **Server orchestration:** `server/routes.ts` constructs OpenRouter payloads, inspects tool calls, and emits debug payloads; `server/app.ts` injects middleware for timing/log truncation.
- **Search helpers:** `server/storage.ts` tokenizes/normalizes queries before running Drizzle `ilike` conditions. All table contracts originate from `shared/schema.ts` to keep inserts, selects, and scripts consistent.
- **Catalog attachments:** `server/catalog-routes.ts` handles uploads via `multer` in memory, validates MIME/size (`server/catalog-file-storage.ts`), streams buffers to Vercel Blob, and records metadata in `catalog_files`. `server/catalog-file-preview.ts` parses previews for pdf/doc/docx/rtf/odt/csv/text (truncated to ~2k chars) so embeddings/jobs can read `textPreview`. Deletions call Blob API first, then remove DB rows; cascade deletes clear files when a catalog item is hard-deleted.
- **Batch catalog import:** `server/catalog-import.ts` parses `.xlsx` buffers (SheetJS), slugifies headers, normalizes PT-BR price/status/tags, and reuses `catalogPayloadSchema` for row validation. Limits: 5MB per file, 500 linhas úteis, and dedupe on nome+fabricante. `bulkInsertCatalogItems` chunks inserts (100) inside a transaction; UI shows summaries/errors and invalidates the catalog query cache on success.
- **Config artifacts:** `plans/` documents retrieval strategies, `drizzle.config.ts` binds schema to migrations, and `vite.config.ts` defines module aliases that keep imports consistent.

## External Integrations
- **OpenRouter (LLM orchestration)** — Authenticated with `OPENROUTER_API_KEY` via Bearer header plus optional referer/title metadata. Payload: Chat Completion request containing Portuguese system prompts and optional `tool_choice`. Retries currently rely on fetch default behavior; errors bubble back to the client with detailed log lines for follow-up.
- **Neon/Postgres (data retrieval)** — `DATABASE_URL` drives pooled WebSocket connections via `@neondatabase/serverless`. Drizzle issues parameterized SQL for FAQs and catalog tables. Search FALLBACK uses normalized `ILIKE` expressions; token logging helps troubleshoot misses. If Neon is unreachable, the API responds 500 with details logged via SSE.
- **Vercel Blob (file storage)** — `@vercel/blob` uploads catalog attachments to bucket `agroremoto-blob` using `BLOB_READ_WRITE_TOKEN`. Optional `BLOB_PUBLIC_BASE_URL` rewrites public URLs; `BLOB_MAX_FILE_SIZE_BYTES` caps uploads (default 10MB). Blob deletions occur before DB metadata removal to avoid orphans.

## Observability & Failure Modes
- **Structured logging:** `server/app.ts` records method, path, status, duration, and (trimmed) JSON payloads for `/api` calls. Messages exceeding 80 chars are truncated but still broadcast via SSE.
- **In-app terminal:** `/api/logs/stream` replays buffered entries so QA can see OpenRouter payloads, tool invocations, and DB counts without SSH.
- **Tool payload tracing:** `server/routes.ts` usa `logToolPayload` para registrar exatamente qual conteúdo dos resultados das funções (`searchFaqs`, `searchCatalog`) é devolvido para a IA, incluindo argumentos resolvidos e prévias truncadas do contexto enviado.
- **Error surfacing:** Any exception in `/api/chat` emits a 500 with `details` plus a console stack trace. There is no retry/backoff yet; operators should monitor for repeated OpenRouter or Neon failures via the SSE feed. Importações em lote logam `[CATALOG_IMPORT] start/parsed/created` e o conjunto inicial de `rowErrors` para auditoria.
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
