
<!-- agent-update:start:glossary -->
# Glossary & Domain Concepts

List project-specific terminology, acronyms, domain entities, and user personas.

## Core Terms
- **RAG Chat** — Retrieval-Augmented Generation workflow implemented by `/api/chat`; the model combines OpenRouter completions with FAQ/catalog snippets fetched via Drizzle before crafting a response.
- **Catalog Tool** — OpenRouter function (`searchCatalog`) exposed in `server/routes.ts` that queries `catalog_items` for active products (name, manufacturer, price, tags). Results are serialized into system messages for the follow-up completion.

## Acronyms & Abbreviations
- **SSE (Server-Sent Events)** — Streaming HTTP protocol used by `/api/logs/stream` to push backend logs into the SPA terminal in real time.

## Personas / Actors
- **Atendente de Suporte** — Portuguese-speaking agent who needs quick, auditable answers for customer FAQs and catalog queries without leaving the web dashboard.

## Domain Rules & Invariants
- Responses must remain in Portuguese with concise, direct tone (enforced by the system prompt in `server/routes.ts`).
- Catalog searches should only surface items with `status = 'ativo'`; archived entries stay hidden unless explicitly requested in future iterations.
- FAQ queries normalize diacritics and casing before hitting the database to handle plural/singular variations documented in `plans/searchFaqsImprovement.prompt.md`.
- Debug metadata returned to the UI (counts, tool usage) should never include sensitive env information—only aggregate telemetry.

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Harvest terminology from recent PRs, issues, and discussions.
2. Confirm definitions with product or domain experts when uncertain.
3. Link terms to relevant docs or modules for deeper context.
4. Remove or archive outdated concepts; flag unknown terms for follow-up.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Product requirement docs, RFCs, user research, or support tickets.
- Service contracts, API schemas, data dictionaries.
- Conversations with domain experts (summarize outcomes if applicable).

<!-- agent-update:end -->
