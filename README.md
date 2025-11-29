# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## Hybrid RAG flow (chat)

```mermaid
flowchart TD
    U[User sends text] --> A[/POST /api/chat/]

    A --> B{Generic product question?}
    B -->|yes| B1[Ask for more details<br/>without querying DB] --> R[Response to client]
    B -->|no| C{Detect catalog/agro intent?}

    C -->|yes| P[Pre-search hybrid<br/>storage.searchCatalogHybrid<br/>lexical + vector]
    C -->|no| D
    P --> PCTX[Inject payload into context as system message]
    PCTX --> D

    D[LLM call #1 (OpenRouter)<br/>tools: searchFaqs, searchCatalog] --> E{Tool calls?}

    E -->|searchFaqs| F[storage.searchFaqs<br/>tokens/ILIKE over FAQs]
    F --> FCTX[Add results to context]
    FCTX --> G

    E -->|searchCatalog| H[storage.searchCatalogHybrid]
    H --> H1[Lexical search<br/>ILIKE over name/description/<br/>category/manufacturer/tags]
    H --> H2[Embeddings via OpenRouter<br/>text-embedding-3-small]
    H2 -->|success| H3[Vector search<br/>catalog_item_embeddings<br/>distance operator]
    H2 -->|fail/no key| H4[Fallback: lexical only<br/>set fallbackReason]
    H1 --> H5[mergeCatalogResults<br/>prioritize vector, dedupe,<br/>respect limit]
    H3 --> H5
    H4 --> H5
    H5 --> HCTX[Add payload to context]
    HCTX --> G

    E -->|none| G[Continue with current context]

    G --> L[LLM call #2 (final answer)] --> R[Response to client + debug]

    %% Debug/stats
    P --> S[Log timings and counts<br/>vectorMs, lexicalMs, mergeMs,<br/>vectorCount, lexicalCount, embeddingUsed]
    H5 --> S
    R --> DBG[Debug payload: query flags, counts, fallbackReason, timings]
```

## Testes rápidos

- Híbrido direto: `curl -X POST http://localhost:3000/api/rag/search -H "Content-Type: application/json" -d '{"query":"adubo foliar","limit":5}'`
- Chat end-to-end: perguntar sobre um produto; o retorno inclui `debug` com flags do RAG.
