# Hybrid RAG (Catalog + Tools) — Design Draft

Context: Implementar o plano `plan-rag-system-hybrid` criando uma rota híbrida que combine embeddings do catálogo de agronomia com as tools existentes (`searchFaqs`, `searchCatalog`) sem quebrar o fluxo atual de `/api/chat`. Bases: `.context/docs/architecture.md`, `.context/docs/data-flow.md`, `.context/docs/tooling.md`, `.context/docs/glossary.md`.

## Objetivos e Não-Objetivos
- **Objetivo:** Responder perguntas gerais de agronomia retornando produtos relevantes via busca vetorial + tool calls, mantendo o comportamento atual para FAQs e catálogo.
- **Latência alvo:** <200ms na busca vetorial + fusão de resultados (sem contar chamadas LLM).
- **Não-objetivos:** Não vamos alterar o cliente além de exibir o contexto enriquecido recebido; sem streaming parcial nem troca do modelo LLM nesta fase.

## Estado Atual (resumo)
- `/api/chat` expõe tools `searchFaqs` e `searchCatalog`, com `tool_choice` forçado por heurística de palavras-chave.
- Storage (`server/storage.ts`) faz busca textual em FAQs (normalizada) e catálogo (ILIKE por campos/tags). Sem vetores ou ranking híbrido.
- Schema (`shared/schema.ts`) contém `catalog_items`, `catalog_files` (metadados + preview de texto opcional), sem colunas de embedding.

## Proposta Técnica
### 1) Modelo de dados e migrações (pgvector)
- Habilitar extensão `pgvector` na migration inicial deste feature.
- Novo helper Drizzle: `vector("embedding", { dimensions: 1536 })` (usa `drizzle-orm` 0.39.x, suportado pelo pg-core). Criar tabela dedicada para evitar inflar `catalog_items`.
  - `catalog_item_embeddings`:
    - `id` (serial PK)
    - `catalogItemId` (FK → `catalog_items.id`, onDelete cascade)
    - `source` (`'item' | 'file' | 'note'`) para diferenciar descrições vs anexos
    - `content` (text) com o texto usado no embedding (nome, descrição, tags, fabricante, trecho de arquivo)
    - `embedding` (vector[1536])
    - `createdAt` timestamp
  - Índices: `index on (catalogItemId)`, `ivfflat` em `embedding` (listas = 100) para similaridade.
- Opcional futuro: coluna `embedding_updated_at` em `catalog_items` para auditoria.

### 2) Pipeline de embeddings
- **Modelo sugerido:** `text-embedding-3-small` via OpenRouter (`baseURL=https://openrouter.ai/api/v1`, provider `openai`). 1536 dims, custo/latência baixos.
- **API client:** Reutilizar `openai` package já instalado, com chave `OPENROUTER_API_KEY` e `X-Title`/`HTTP-Referer` opcionais.
- **Chunking de arquivos:** Usar `catalog_files.textPreview` como base; se ausente, retornar TODO para OCR/parsers. Para anexos grandes, dividir em blocos ~500-800 tokens e criar múltiplas entradas `source=file`.
- **Scripts:**
  - `scripts/seedCatalogEmbeddings.ts`: lê `catalog_items` + `catalog_files`, gera embeddings, upserts em `catalog_item_embeddings`.
  - Hooks em CRUD: em `server/storage.ts`, após `createCatalogItem`/`updateCatalogItem` disparar fila síncrona simples (`enqueueEmbeddingJob` ou chamada direta) para gerar/atualizar embedding de `source=item`. Para arquivos, chamar após upload (`createCatalogFile`).
- **Config/env:** `EMBEDDING_MODEL=text-embedding-3-small`, `EMBEDDING_DIMENSIONS=1536`, `EMBEDDING_BATCH_SIZE=16` (para scripts). Validar na inicialização e logar.

### 3) Busca híbrida (vetorial + lexical)
- Nova função `searchCatalogHybrid(query, limit)` em `server/storage.ts`:
  - Gera embedding da `query` (mesmo modelo).
  - Vetorial: `SELECT ... ORDER BY embedding <#> $1 LIMIT limit` em `catalog_item_embeddings` filtrando por `catalog_items.status='ativo'`.
  - Lexical: reusar `searchCatalog` atual (ILIKE).
  - Fusão: deduplicar por `catalogItemId`, priorizar vetorial, intercalar lexical, devolver `score` e `source`.
- Enriquecimento do payload para LLM: serializar top-K em formato compacto (`name | categoria | fabricante | preço | tags | snippet | score`).
- Observabilidade: logar contagem vetorial/lexical, tempo de consulta e dimensão do embedding.

### 4) Atualização de `/api/chat`
- Detectar **intenção geral de agronomia**: regra simples (keywords + falta de SKU) antes da primeira chamada LLM. Se verdadeiro, executar `searchCatalogHybrid` imediatamente e anexar contexto como mensagem `system` antes da primeira call (garantindo RAG mesmo sem tool).
- Tool orchestration:
  - Manter tools `searchFaqs`/`searchCatalog` para compatibilidade.
  - Quando `searchCatalog` for chamado, incluir resultados híbridos ao invés de apenas lexical, retornando também o `score`.
  - Adicionar metadado `ragSource: "hybrid"` no debug.
- Novo endpoint opcional para QA: `POST /api/rag/search { query, limit }` retornando vetorial+lexical e tempos; protegido apenas por rate-limit básico.

### 5) Cliente (mínimo)
- Nenhuma mudança obrigatória. Opcional: exibir no debug do chat que os resultados vieram do índice vetorial e mostrar contagens (já retornado em `debug`).

## Segurança, Confiabilidade e Performance
- **Perf:** Cache em memória para embeddings de queries recentes (LRU pequeno) para evitar chamadas repetidas ao modelo em perguntas semelhantes; timeout de 2s no gerador de embeddings.
- **Dados:** Não armazenar textos sensíveis nos embeddings; sanitizar `textPreview` ao salvar.
- **Erros:** Se geração de embedding falhar, cair para fluxo lexical atual (log de warning).
- **Latência:** ivfflat requer `ANALYZE`; rodar após `db:push` + seed. Ajustar `lists` conforme volume.
- **Migration rollback:** Dropar índice/tabela `catalog_item_embeddings`; nenhum dado crítico é perdido (regerar via seed).

## Plano de Entrega (fases alinhadas ao plan-rag-system-hybrid)
- **Fase 1 (Discovery)**
  - Confirmar suporte pgvector no Postgres alvo (Neon) e versão do driver.
  - Escolher modelo de embedding definitivo e dimensões; validar custo.
  - Definir formato de payload enviado ao LLM (campos por item, limite de tokens).
- **Fase 2 (Implementação)**
  - Criar migrations + Drizzle schema `catalog_item_embeddings`.
  - Implementar `generateCatalogEmbedding`, `searchCatalogVector`, `searchCatalogHybrid`.
  - Ajustar `/api/chat` para usar híbrido e adicionar endpoint `/api/rag/search`.
  - Criar script `seedCatalogEmbeddings.ts`.
- **Fase 3 (Validação)**
  - Testes unitários: normalização, fusão de rankings, cálculo de scores.
  - Testes de integração: fluxo `/api/chat` com e sem tool, endpoint `/api/rag/search`, seed script.
  - Benchmarks de latência (<200ms consulta híbrida com 1k embeddings) e auditoria de segurança (inputs sanitizados).

## Testes e Evidências Esperadas
- Unit: `searchCatalogHybrid` devolve ordem vetorial > lexical quando score menor.
- Integration: chamada `/api/chat` com pergunta geral sobre “fertilizante foliar” inclui contexto vetorial no log e na resposta.
- Seed script idempotente: reexecutar não duplica embeddings (`upsert` por `catalogItemId` + `source`).
- Observabilidade: logs SSE mostram tempos (`ms`) e contagens (vetorial/lexical).

## Perguntas em Aberto
- Volume esperado de itens/arquivos? Define listas do ivfflat e necessidade de quantização.
- Podemos garantir `textPreview` em todos os anexos ou precisamos de pipeline de extração (PDF/IMG)?
- Há orçamento para usar um modelo mais robusto (`text-embedding-3-large`) caso a precisão do small não atinja metas?
- O cliente móvel (futuro) exige contrato separado para `/api/rag/search`?

## Próximos Passos Imediatos
1. Validar pgvector no banco (Neon) e criar migration boilerplate.
2. Implementar client de embeddings em um módulo dedicado (`server/embeddings.ts`) com baseURL OpenRouter.
3. Prototipar `searchCatalogHybrid` em storage com logging de tempos.
