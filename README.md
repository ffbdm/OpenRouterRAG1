# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## Fluxo RAG híbrido (chat)

```mermaid
flowchart TD
    U[Usuário envia texto] --> A[/POST /api/chat/]

    A --> B{Mensagem genérica de produtos?}
    B -- sim --> B1[Responder pedindo detalhes\nsem consultar BD] --> R[Resposta ao cliente]
    B -- não --> C{Detecta intenção\ncatálogo/agro?}

    C -- sim --> P[Pré-busca híbrida\nstorage.searchCatalogHybrid\n(lexical + vetorial)] --> PCTX[Injeta payload no contexto (system)] --> D
    C -- não --> D

    D[Chamada LLM #1 (OpenRouter)\ntools: searchFaqs, searchCatalog] --> E{Tool calls?}

    E -- searchFaqs --> F[storage.searchFaqs\ntokens/ILIKE em FAQs] --> FCTX[Adiciona resultados ao contexto] --> G
    E -- searchCatalog --> H[storage.searchCatalogHybrid]
    H --> H1[Busca lexical\nILIKE em nome/descrição/\ncategoria/fabricante/tags]
    H --> H2[Embeddings via OpenRouter\ntext-embedding-3-small]
    H2 -->|sucesso| H3[Busca vetorial\ncatalog_item_embeddings\ndistância <#>]
    H2 -->|falha/sem chave| H4[Fallback: só lexical\nmarca fallbackReason]
    H1 & H3 --> H5[mergeCatalogResults\nprioriza vetorial, deduplica,\nrespeita limite] --> HCTX[Adiciona payload ao contexto] --> G
    E -- nenhuma --> G[Segue com contexto atual]

    G --> L[Chamada LLM #2 (resposta final)] --> R[Resposta ao cliente + debug]

    %% Debug/stats
    P & H5 --> S[Logs de tempos e contagens\n(vectorMs, lexicalMs, mergeMs,\nvectorCount, lexicalCount, embeddingUsed)]
    R --> DBG[Payload debug: flags de consulta, contagens, fallbackReason, timings]
```

## Testes rápidos

- Híbrido direto: `curl -X POST http://localhost:3000/api/rag/search -H "Content-Type: application/json" -d '{"query":"adubo foliar","limit":5}'`
- Chat end-to-end: perguntar sobre um produto; o retorno inclui `debug` com flags do RAG.
