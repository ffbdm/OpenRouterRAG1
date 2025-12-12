<!-- agent-update:start:data-flow -->
# Data Flow & Integrations

Explain how data enters, moves through, and exits the system, including interactions with external services.

## High-level Flow
1. The React SPA collects a Portuguese prompt and sends `POST /api/chat { message, history }`, where `history` carries the most recent user/assistant turns. The server clamps the array to `CHAT_HISTORY_CONTEXT_LIMIT` (default 6, max 20) and truncates each message (~1200 chars) before passing it to the model.
2. Express chama o OpenRouter com o modelo `OPENROUTER_MODEL_CLASSIFY` (ou fallback) para classificar a intenção em **uma única palavra** (`FAQ`, `CATALOG`, `MIST`, `OTHER`) sem usar tools, max_tokens baixo e temperatura 0.
3. O backend normaliza a intenção, decide quais buscas executar (`searchFaqsHybrid`, `searchCatalogHybrid`, ambas ou nenhuma), registra `classification`, `usedTools`, `llmCalls` e executa as queries via Drizzle.
4. Um contexto único é construído começando pelo histórico recente (ordenado do mais antigo ao mais novo, já limitado pelo env var), seguido da mensagem do usuário, FAQs relevantes e produtos do catálogo (quando houver), sem expor a palavra de intenção; `logToolPayload`, `logFaqHybridStats` e `logHybridStats` alimentam o terminal.
5. A segunda chamada ao OpenRouter usa `OPENROUTER_MODEL_ANSWER` (ou fallback) sem tools, recebendo apenas instruções de resposta e o contexto consolidado para gerar o texto final.
6. Express não persiste estado: a resposta final e o objeto `debug` voltam para o SPA enquanto o terminal consome `/api/logs/stream` com os mesmos eventos estruturados (incluindo `classification=...`).
7. The catalog admin page now issues `GET/POST /api/catalog/:id/files` and `DELETE /api/catalog/files/:fileId` to upload/list/remove attachments stored in Vercel Blob; metadata is persisted in Postgres for RAG context.
8. Admins can download the `.xlsx` template via `GET /api/catalog/import/template` and upload batches through `POST /api/catalog/import` (multipart); the backend validates headers/rows, dedupes by nome+fabricante, and inserts in Drizzle chunks inside a transaction.

## Internal Movement
- **Client → Server:** `client/src/pages/chat.tsx` uses `apiRequest` (React Query) to call the API and listens to `/api/logs/stream` via `LogTerminal`. `client/src/pages/catalog.tsx` now manages file uploads and lists with React Query keyed by catalog item ID.
- **Server orchestration:** `server/routes.ts` executa a etapa de classificação (intent única), roteia buscas para FAQ/Catálogo conforme `planSearches`, consolida contexto e chama o modelo de resposta sem tools; `server/app.ts` injeta middleware para timing/log truncation.
- **Search helpers:** `server/storage.ts` tokenizes/normalizes queries before running Drizzle `ilike` conditions. All table contracts originate from `shared/schema.ts` to keep inserts, selects, and scripts consistent.
- **Catalog attachments:** `server/catalog-routes.ts` handles uploads via `multer` in memory, validates MIME/size (`server/catalog-file-storage.ts`), streams buffers to Vercel Blob, and records metadata in `catalog_files`. `server/catalog-file-preview.ts` parses previews for pdf/doc/docx/rtf/odt/csv/text (truncated to ~2k chars) so embeddings/jobs can read `textPreview`. Deletions call Blob API first, then remove DB rows; cascade deletes clear files when a catalog item is hard-deleted.
- **Batch catalog import:** `server/catalog-import.ts` parses `.xlsx` buffers (SheetJS), slugifies headers, normalizes PT-BR price/status/tags, and reuses `catalogPayloadSchema` for row validation. Limits: 5MB per file, 500 linhas úteis, and dedupe on nome+fabricante. `bulkInsertCatalogItems` chunks inserts (100) inside a transaction; UI shows summaries/errors and invalidates the catalog query cache on success.
- **Config artifacts:** `plans/` documents retrieval strategies, `drizzle.config.ts` binds schema to migrations, and `vite.config.ts` defines module aliases that keep imports consistent.

## External Integrations
- **OpenRouter (LLM orchestration)** — Authenticated with `OPENROUTER_API_KEY` via Bearer header plus optional referer/title metadata. Duas chamadas: classificação (`OPENROUTER_MODEL_CLASSIFY`, sem tools, temp 0, `max_tokens` baixo) e resposta final (`OPENROUTER_MODEL_ANSWER`, sem tools, temp 0.7). Retries currently rely on fetch default behavior; errors bubble back to the client with detailed log lines for follow-up.
- **Neon/Postgres (data retrieval)** — `DATABASE_URL` drives pooled WebSocket connections via `@neondatabase/serverless`. Drizzle issues parameterized SQL for FAQs and catalog tables. Search FALLBACK uses normalized `ILIKE` expressions; token logging helps troubleshoot misses. If Neon is unreachable, the API responds 500 with details logged via SSE.
- **Vercel Blob (file storage)** — `@vercel/blob` uploads catalog attachments to bucket `agroremoto-blob` using `BLOB_READ_WRITE_TOKEN`. Optional `BLOB_PUBLIC_BASE_URL` rewrites public URLs; `BLOB_MAX_FILE_SIZE_BYTES` caps uploads (default 10MB). Blob deletions occur before DB metadata removal to avoid orphans.

## Observability & Failure Modes
- **Structured logging:** `server/app.ts` records method, path, status, duration, and (trimmed) JSON payloads for `/api` calls. Messages exceeding 80 chars are truncated but still broadcast via SSE.
- **In-app terminal:** `/api/logs/stream` replays buffered entries so QA can see OpenRouter payloads, tool invocations, and DB counts without SSH.
- **Tool payload tracing:** `server/routes.ts` usa `logToolPayload` para registrar exatamente qual conteúdo dos resultados das funções (`searchFaqsHybrid`, `searchCatalogHybrid`) é devolvido para a IA, incluindo argumentos resolvidos e prévias truncadas do contexto enviado.
- **Error surfacing:** Any exception in `/api/chat` emits a 500 with `details` plus a console stack trace. There is no retry/backoff yet; operators should monitor for repeated OpenRouter or Neon failures via the SSE feed. Importações em lote logam `[CATALOG_IMPORT] start/parsed/created` e o conjunto inicial de `rowErrors` para auditoria.
- **Safeguards:** O prompt de classificação força uma resposta única (FAQ/CATALOG/MIST/OTHER) e o roteamento backend garante que a segunda chamada não use tools. Logs trazem `classification`, `usedTools`, `llmCalls` e contagens para identificar quedas de recall ou latência extra ao adicionar a etapa de classificação.

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
