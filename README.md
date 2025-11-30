# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## System flow

```mermaid
graph TD;
    U[User] --> C[POST /api/chat];

    C -->|generic catalog question| Clarify[Ask category/price range; skip DB];
    C -->|agro/catalog intent| PreHybrid[Pre hybrid search (vector + lexical)];
    C -->|other| FirstLLM[LLM call #1<br/>Tools=searchFaqs/searchCatalog];

    PreHybrid --> PreCtx[Hybrid context as system message];
    PreCtx --> FirstLLM;

    FirstLLM -->|no tool/no DB| Direct[Direct answer<br/>llmCalls=1];
    Direct --> Resp[Response + debug];

    FirstLLM -->|tool call| Tools[searchFaqs/searchCatalog + Drizzle];
    Tools --> Ctx[Attach FAQ/Catalog context];
    Ctx --> FinalLLM[LLM call #2];
    FinalLLM --> Resp;

    Tools --> Logs[logToolPayload + métricas híbridas];
    PreHybrid --> Logs;
    C --> Logs;
    Logs --> SSE[/api/logs/stream para a UI];
```

- `requiresProductClarification` keeps the DB untouched when the ask is too generic.
- `detectAgronomyIntent` triggers the pre hybrid search and injects its summary as a `system` message before the LLM decides to call tools.
- If no structured source is consulted (`databaseQueried=false`), the response comes from the first call only (`llmCalls=1`).
- When tools run, the backend performs hybrid catalog + FAQ lookups, attaches context, and issues the second OpenRouter call.
- Search logs and tool payloads stream via SSE to the in-app terminal.

## Testes rápidos

- Híbrido direto: `curl -X POST http://localhost:3000/api/rag/search -H "Content-Type: application/json" -d '{"query":"adubo foliar","limit":5}'`
- Chat end-to-end: perguntar sobre um produto; o retorno inclui `debug` com flags do RAG.
