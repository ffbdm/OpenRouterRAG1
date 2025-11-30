# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## System flow

```mermaid
flowchart TD
    U[User message] --> Chat[POST /api/chat];

    Chat -->|generic product list| Clarify[Ask category/price; ends here];
    Chat -->|otherwise| Build[Prime system + user messages];

    Build --> Agronomy{detectAgronomyIntent?};
    Agronomy -->|yes| PreHybrid[Pre hybrid catalog search (vector + lexical); databaseQueried=true];
    PreHybrid --> PreCtx[Attach hybrid summary as system message];
    PreHybrid --> LogPre[logHybridStats];
    Agronomy -->|no| Force;

    Build --> Force{detectForcedTool?};
    PreCtx --> Force;

    Force -->|catalog intent| FirstLLM[OpenRouter call #1\nTools: searchFaqs/searchCatalog\n tool_choice=searchCatalog];
    Force -->|none| FirstLLM;

    FirstLLM --> Tools{Tool calls?};
    Tools -->|no| DBCheck{databaseQueried?};
    DBCheck -->|no| Direct[Direct answer; llmCalls=1; ragSource=none];
    DBCheck -->|yes| SecondLLM;
    Direct --> Resp[Response + debug];

    Tools -->|yes| ToolFanout[Run requested tools];
    ToolFanout --> FAQ[searchFaqs -> DB FAQs];
    ToolFanout --> Catalog[searchCatalog -> hybrid];
    FAQ --> FAQCtx[Add FAQ payload to messages];
    Catalog --> CatalogCtx[Add catalog payload; ragSource=hybrid];
    FAQ --> ToolLog[logToolPayload + counts];
    Catalog --> ToolLog;

    FAQCtx --> SecondLLM;
    CatalogCtx --> SecondLLM;
    PreCtx --> SecondLLM;
    SecondLLM[OpenRouter call #2 with collected contexts] --> Resp;

    ToolLog --> SSE[/api/logs/stream -> UI];
    LogPre --> SSE;
```

- `requiresProductClarification` encerra o fluxo antes de qualquer chamada de LLM/DB quando o pedido é apenas “liste produtos”.
- `detectAgronomyIntent` dispara uma pré-busca híbrida e injeta seu resumo como `system`, marcando `databaseQueried=true` mesmo que a IA não chame tools depois.
- `detectForcedTool` força `tool_choice=searchCatalog` quando há forte intenção de catálogo para evitar respostas sem contexto.
- Se `databaseQueried=false` (sem pré-busca e sem tool calls), a resposta vem apenas da primeira chamada (`llmCalls=1`, `ragSource=none`).
- Quando tools são acionadas, o backend consulta FAQs + catálogo híbrido, anexa o contexto e faz a segunda chamada OpenRouter.
- Logs de busca, payloads de tool e tempos chegam ao terminal via SSE.

## Testes rápidos

- Híbrido direto: `curl -X POST http://localhost:3000/api/rag/search -H "Content-Type: application/json" -d '{"query":"adubo foliar","limit":5}'`
- Chat end-to-end: perguntar sobre um produto; o retorno inclui `debug` com flags do RAG.

## Painel de instruções editável

- O backend expõe `GET /api/instructions` (filtro opcional `?scope=chat,catalog`) e `PUT /api/instructions/:slug` para atualizar o conteúdo versionado na tabela `system_instructions`.
- A SPA mostra o painel diretamente nas páginas de Chat e Catálogo, reutilizando o componente `InstructionsPanel` para listar, editar e salvar instruções com React Query.
- O prompt do chat (`chat-system`) agora é lido do banco antes de cada requisição; se o registro não existir, o servidor aplica o fallback codificado.
- Após atualizar `shared/schema.ts`, rode `npm run db:push` para criar a nova tabela e inserir os seeds (`chat-system`, `catalog-guidelines`, `global-operating-principles`).
