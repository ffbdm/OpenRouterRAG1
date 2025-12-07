# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## System flow

```mermaid
flowchart TD
    U[User message] --> Chat[POST /api/chat]

    Chat --> LoadInstr[Load chatGather/chatRespond<br/>from DB (fallbacks ready)]
    LoadInstr --> ToolRules[Append toolUsageReminder<br/>+ user message]

    ToolRules --> FirstCall[OpenRouter call #1<br/>tools: searchFaqs/searchCatalog]
    FirstCall --> Tools{Tool calls?}

    Tools -->|no| Direct[Return first answer<br/>databaseQueried = false]
    Direct --> Resp

    Tools -->|yes| ToolFanout[Execute requested tools]

    ToolFanout --> FAQ[searchFaqs → Postgres]
    ToolFanout --> Catalog[searchCatalog → hybrid merge]

    FAQ --> FAQCtx[Push FAQ JSON<br/>as system message]
    Catalog --> CatalogCtx[Push hybrid summary<br/>ragSource = hybrid]

    FAQ --> ToolLog[logToolPayload → SSE]
    Catalog --> ToolLog
    Catalog --> HybridStats[logHybridStats → SSE]

    FAQCtx --> FinalReminder[Append finalResponseReminder]
    CatalogCtx --> FinalReminder

    FinalReminder --> SecondCall[OpenRouter call #2<br/>no tools, temp 0.7]
    SecondCall --> Resp[Response + debug<br/>(db flags, timings)]
```

- As instruções `chatGather` e `chatRespond` são lidas do banco (fallback codificado garante resiliência) e forçam a operação em duas etapas com coleta de dados explícita antes da resposta.
- O `toolUsageReminder` adiciona regras rígidas: `searchCatalog` é obrigatório para consultas de produto/cultivo/fabricante/preço e `searchFaqs` cobre políticas/processos; cumprimentos simples não devem acionar tools.
- A primeira chamada OpenRouter roda com `tool_choice=auto`; se nenhuma tool for acionada (`databaseQueried=false`), o backend devolve diretamente o texto da IA e marca `ragSource=none` em `debug`.
- Quando há tool calls, `searchFaqs` usa a query enviada (ou cai para a mensagem do usuário) e devolve o JSON bruto; `searchCatalog` executa a busca híbrida (vetorial + lexical), monta um resumo textual e registra estatísticas via `logHybridStats`.
- Cada resultado vira uma nova mensagem `system` antes da segunda chamada, e `logToolPayload` alimenta o `/api/logs/stream` para o terminal em tempo real.
- A segunda chamada recebe um `finalResponseReminder` que dita a formatação padrão (resumo da busca, resposta principal, próximos passos) e limita o modelo a usar apenas os dados fornecidos.
- A resposta final inclui `debug` com contagens de FAQs/itens, `ragSource`, tempos da busca híbrida e o número de chamadas LLM (`llmCalls=2`).

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
