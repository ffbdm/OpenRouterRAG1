# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## Hybrid RAG flow (chat)

```mermaid
flowchart TD
    U[User text] --> A[POST /api/chat]

    A --> B{Generic product?}
    B -->|yes| Clarify[Ask for details<br/>skip DB] --> R[Reply]
    B -->|no| Intent{Catalog/agro intent?}

    Intent -->|yes| Pre[Pre-search hybrid]
    Pre --> PreCtx[Add system context]
    Intent -->|no| FirstLLM[LLM call #1<br/>tools available]
    PreCtx --> FirstLLM

    FirstLLM -->|searchFaqs| Faqs[searchFaqs]
    Faqs --> FaqCtx[Add FAQ context]
    FaqCtx --> MergeCtx[Context ready]

    FirstLLM -->|searchCatalog| Hybrid[searchCatalogHybrid]
    Hybrid --> Lex[Lexical search]
    Hybrid --> Emb[Generate embedding]
    Emb -->|ok| Vec[Vector search]
    Emb -->|fail| Fallback[Lexical only]
    Lex --> Merge[mergeCatalogResults]
    Vec --> Merge
    Fallback --> Merge
    Merge --> CatCtx[Add catalog context]
    CatCtx --> MergeCtx

    FirstLLM -->|none| MergeCtx

    MergeCtx --> Final[LLM call #2<br/>final answer]
    Final --> R[Reply + debug]

    %% Debug/stats
    Merge --> Stats[Log timings and counts]
```

## Testes rápidos

- Híbrido direto: `curl -X POST http://localhost:3000/api/rag/search -H "Content-Type: application/json" -d '{"query":"adubo foliar","limit":5}'`
- Chat end-to-end: perguntar sobre um produto; o retorno inclui `debug` com flags do RAG.
