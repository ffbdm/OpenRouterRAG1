# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## Hybrid RAG flow (chat)

```mermaid
flowchart TD
    U[User sends text] --> A[/POST /api/chat/]

    A --> B{Generic product question?}
    B -- yes --> B1[Ask for more details\nwithout querying DB] --> R[Response to client]
    B -- no --> C{Detect catalog/agro intent?}

    C -- yes --> P[Pre-search hybrid\nstorage.searchCatalogHybrid\nlexical + vector] --> PCTX[Inject payload into context (system)] --> D
    C -- no --> D

    D[LLM call #1 (OpenRouter)\ntools: searchFaqs, searchCatalog] --> E{Tool calls?}

    E -- searchFaqs --> F[storage.searchFaqs\ntokens/ILIKE over FAQs] --> FCTX[Add results to context] --> G
    E -- searchCatalog --> H[storage.searchCatalogHybrid]
    H --> H1[Lexical search\nILIKE over name/description/\ncategory/manufacturer/tags]
    H --> H2[Embeddings via OpenRouter\ntext-embedding-3-small]
    H2 -->|success| H3[Vector search\ncatalog_item_embeddings\ndistance operator]
    H2 -->|fail/no key| H4[Fallback: lexical only\nset fallbackReason]
    H1 & H3 --> H5[mergeCatalogResults\nprioritize vector, dedupe,\nrespect limit] --> HCTX[Add payload to context] --> G
    E -- none --> G[Continue with current context]

    G --> L[LLM call #2 (final answer)] --> R[Response to client + debug]

    %% Debug/stats
    P & H5 --> S[Log timings and counts\n(vectorMs, lexicalMs, mergeMs,\nvectorCount, lexicalCount, embeddingUsed)]
    R --> DBG[Debug payload: query flags, counts, fallbackReason, timings]
```

## Testes rápidos

- Híbrido direto: `curl -X POST http://localhost:3000/api/rag/search -H "Content-Type: application/json" -d '{"query":"adubo foliar","limit":5}'`
- Chat end-to-end: perguntar sobre um produto; o retorno inclui `debug` com flags do RAG.
