# OpenRouterRAG

Assistente de FAQ e catálogo com RAG híbrido (lexical + vetorial) via OpenRouter, Express e Vite.

## Fluxo do sistema

```mermaid
flowchart TD
    U[Usuário] --> C[POST /api/chat]

    C -->|pergunta genérica de catálogo| Clarify[Solicita categoria/faixa de preço<br/>retorna sem DB]
    C -->|intenção agro/catalogo| PreHybrid[Pré-busca híbrida]
    C -->|outros| FirstLLM[Chamada LLM #1<br/>tools=searchFaqs/searchCatalog]

    PreHybrid --> PreCtx[Contexto híbrido vira system message]
    PreCtx --> FirstLLM

    FirstLLM -->|sem tool ou sem DB| Direct[Resposta direta<br/>llmCalls=1]
    Direct --> Resp[Resposta + debug]

    FirstLLM -->|tool call| Tools[Executa searchFaqs/searchCatalog via Drizzle]
    Tools --> Ctx[Anexa contexto FAQ/Catálogo]
    Ctx --> FinalLLM[Chamada LLM #2]
    FinalLLM --> Resp

    Tools --> Logs[logToolPayload + métricas híbridas]
    PreHybrid --> Logs
    C --> Logs
    Logs --> SSE[/api/logs/stream para a UI]
```

- `requiresProductClarification` evita consultar DB quando o pedido é genérico demais.
- `detectAgronomyIntent` dispara pré-busca híbrida e injeta o resumo como `system` antes do LLM decidir usar tools.
- Se nenhuma fonte estruturada for consultada (`databaseQueried=false`), a resposta já sai da primeira chamada (`llmCalls=1`).
- Quando tools são acionadas, o backend usa busca híbrida (vetorial + lexical) e FAQs, agrega contexto e faz a segunda chamada ao OpenRouter.
- Logs de busca e payloads de tool são enviados via SSE para o terminal embutido no cliente.

## Testes rápidos

- Híbrido direto: `curl -X POST http://localhost:3000/api/rag/search -H "Content-Type: application/json" -d '{"query":"adubo foliar","limit":5}'`
- Chat end-to-end: perguntar sobre um produto; o retorno inclui `debug` com flags do RAG.
