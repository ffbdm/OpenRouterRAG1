# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## System flow

```mermaid
flowchart TD
    U[User message] --> Chat[POST /api/chat]

    Chat -->|generic product list| Clarify[Ask category/price<br/>stop flow]
    Chat -->|otherwise| Build[Prime system + user messages]

    %% Nó de decisão de intenção agronômica
    Agronomy{detectAgronomyIntent}
    Build --> Agronomy

    %% Nó de pré-busca híbrida
    PreHybrid{"Pre hybrid catalog search (vector + lexical)", databaseQueried: true}
    Agronomy -->|yes| PreHybrid

    PreHybrid --> PreCtx[Attach hybrid summary<br/>as system message]
    PreHybrid --> LogPre[logHybridStats]

    Agronomy -->|no| Force{detectForcedTool?}

    Build --> Force
    PreCtx --> Force

    Force -->|catalog intent| FirstLLM[OpenRouter call #1<br/>tools: searchFaqs / searchCatalog<br/>tool_choice = searchCatalog]
    Force -->|none| FirstLLM

    FirstLLM --> Tools{Tool calls?}

    Tools -->|no| DBCheck{databaseQueried?}
    DBCheck -->|no| Direct[Direct answer<br/>llmCalls = 1<br/>ragSource = none]
    DBCheck -->|yes| SecondLLM[OpenRouter call #2<br/>with collected contexts]
    Direct --> Resp[Response + debug]

    Tools -->|yes| ToolFanout[Run requested tools]
    ToolFanout --> FAQ[searchFaqs -> FAQ DB]
    ToolFanout --> Catalog[searchCatalog -> hybrid]

    FAQ --> FAQCtx[Add FAQ payload to messages]
    Catalog --> CatalogCtx[Add catalog payload<br/>ragSource = hybrid]

    FAQ --> ToolLog[logToolPayload + counts]
    Catalog --> ToolLog

    PreCtx --> SecondLLM
    FAQCtx --> SecondLLM
    CatalogCtx --> SecondLLM
    SecondLLM --> Resp    
    ToolLog --> SSE["/api/logs/stream" -> UI]
    LogPre --> SSE
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
- O prompt do chat passou a ser dividido em duas mensagens `system`: `buscar-dados` (etapa 1, coleta de contexto) e `responder-usuario` (etapa 2, formatação da resposta). Ambas são lidas do banco em ordem determinística e têm fallback codificado caso o registro seja removido.
- Após atualizar `shared/schema.ts`, rode `npm run db:push` para criar/alterar a tabela e inserir os seeds (`global-operating-principles`, `buscar-dados`, `responder-usuario`, `catalog-guidelines`).

## Importação em lote do catálogo

- `GET /api/catalog/import/template` gera a planilha `.xlsx` com cabeçalho fixo (Nome, Descrição, Categoria, Fabricante, Preço, Status, Tags) e duas linhas de exemplo.
- `POST /api/catalog/import` aceita apenas `.xlsx` (5MB, 500 linhas úteis) via `multipart/form-data` com campo `file`; valida cabeçalho, deduplica linhas por par nome+fabricante e aplica o schema existente do catálogo.
- Em caso de erro, retorna `400` com `{ errors: [{ row, fields, message }] }` sem inserir nada. Sucesso retorna `{ created, durationMs, sampleIds }`.
- A página `/catalogo` tem a seção “Importar catálogo em lote” com download do template, upload arraste-e-solte e resumo de erros ou itens criados; ao concluir, a lista é atualizada automaticamente.
