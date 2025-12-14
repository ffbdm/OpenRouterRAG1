<!-- agent-update:tool-calls -->
# Tool Calls (RAG) — Documentação Técnica

Este documento descreve **de forma detalhada e operacional** como o backend executa “tool calls” (chamadas a ferramentas internas) para enriquecer a resposta da IA com dados do banco.

> Importante: neste repositório, “tool call” **não** é o mesmo que “function calling nativo” do modelo.
> Aqui, “tool call” significa: **o servidor decide e executa uma ferramenta interna (ex.: `searchCatalogHybrid`) e injeta o resultado no contexto da segunda chamada ao OpenRouter**.

---

## 1) O que é uma “tool call” neste projeto

### 1.1 Definição
Uma *tool call* é uma etapa controlada pelo servidor, usada para:

1. **Consultar fontes externas** (principalmente Postgres via Drizzle) para coletar contexto; e
2. **Converter esse resultado em texto** que a IA consiga usar; e
3. **Entregar esse texto à IA** na mensagem final (sem mencionar a “seção de contexto”).

### 1.2 Onde aparece no código
- Planejamento de tools por intenção: `planSearches(intent)`
- Execução das tools (busca catálogo/FAQ): dentro do handler `POST /api/chat`
- Formatação do payload que vai para a IA: `buildCatalogPayload(...)`
- Auditoria (log do conteúdo entregue à IA): `logToolPayload(...)`

### 1.3 Por que existe (e por que não usa tools nativas do modelo)
O desenho atual reduz risco e complexidade porque:

- Evita que o modelo invente argumentos de consulta ou execute calls sem controle.
- Mantém a decisão de “quando consultar banco” determinística (por intenção).
- Mantém rastreabilidade do que foi entregue ao modelo (via logs).

Trade-offs:
- A IA não decide dinamicamente parâmetros sofisticados de busca (ex.: filtros) — a ferramenta é chamada com parâmetros simples.
- O pipeline depende bastante do classificador de intenção.

---

## 2) Visão geral do pipeline de chat (onde tool calls entram)

O fluxo do `POST /api/chat` é, em alto nível:

1. Valida request (`message`, `history`).
2. **Chamada 1 ao OpenRouter (classificação)**: identifica a intenção do usuário.
3. Deriva `queryContext` do histórico recente (pequeno resumo textual para enriquecer buscas).
4. Planeja quais tools executar (`planSearches`).
5. Executa tool calls planejadas:
   - `searchFaqsHybrid` (quando aplicável)
   - `searchCatalogHybrid` (quando aplicável)
6. Constrói `contextSections` consolidado (histórico + resultados de tools).
7. **Chamada 2 ao OpenRouter (resposta final)** sem tools: entrega o contexto consolidado e a pergunta.

A tool call de catálogo (`searchCatalogHybrid`) fica no passo 5.

---

## 3) Documentação da tool call: `searchCatalog` (sistema de busca de catálogo)

### 3.1 Nome “externo” da tool
Nos logs e no planejamento, ela aparece como:
- `toolName`: `"searchCatalog"`
- `source`: tipicamente `"hybrid"` quando chamada via chat

### 3.2 Onde é chamada
Existem dois caminhos principais:

1) **Chat RAG (principal)**
- Endpoint: `POST /api/chat`
- Condição: `planSearches(intent).runCatalog === true`
- Execução: chama `storage.searchCatalogHybrid(catalogSearchQuery, resolvedLimit, { queryContext })`, onde:
  - Por padrão: `catalogSearchQuery = userMessage`
  - Opcional: quando `CATALOG_QUERY_KEYWORDS_ENABLED=true` e o resumo automático gerou `catalogQuery`, usa `catalogSearchQuery = catalogQuery` (fallback continua sendo `userMessage`)

2) **Busca direta de RAG (debug/API)**
- Endpoint: `POST /api/rag/search`
- Execução: chama `storage.searchCatalogHybrid(query, resolvedLimit)`

O foco deste documento é o comportamento do `storage.searchCatalogHybrid(...)`.

---

## 4) `searchCatalogHybrid`: o que faz, passo a passo

### 4.1 Assinatura (conceitual)
Entrada:
- `query: string` — texto do usuário
- `limit: number` — máximo de resultados (capado internamente)
- `options?: { queryContext?: string }` — contexto derivado do histórico

Saída (`CatalogHybridSearchResult`):
- `results: CatalogHybridHit[]` — lista final ordenada
- `vectorCount`, `lexicalCount` — contadores por fonte
- `embeddingUsed: boolean` — se a etapa vetorial foi utilizada
- `fallbackReason?: string` — motivo de fallback quando aplicável
- `timings` — tempos por etapa

### 4.2 Etapa A — normalização de limite
- O `limit` recebido é “clampado” por `clampCatalogLimit(limit)`.
- Isso evita limites inválidos e impõe um máximo global.

### 4.3 Etapa B — `effectiveQuery`: query + contexto
A busca híbrida pode considerar histórico recente.

- O servidor cria `effectiveQuery` assim:
  - `effectiveQuery = query` (atualmente o catálogo **não** concatena `queryContext`).

Motivação:
- Evitar “poluição” da busca com texto de conversa (ex.: saudações), mantendo a query focada em termos do catálogo.

Observações operacionais:
- O log pode mostrar:
  - `catalogQuery gerada a partir do resumo: "..."` (quando `CATALOG_QUERY_KEYWORDS_ENABLED=true`)

### 4.4 Etapa C — busca lexical (SQL)
O pipeline lexical começa consultando o banco via `searchCatalog(effectiveQuery, finalLimit)`.

#### 4.4.1 O que é “lexical” aqui
É a busca baseada em *substring match* (`ILIKE %term%`) em colunas textuais.

#### 4.4.2 Como os termos são derivados
A condição SQL é construída por `buildCatalogSearchCondition(query)`:

- `tokens = extractSearchTokens(query)`
- `normalizedQuery = normalizeText(query)`
- `terms`:
  - se `tokens.length > 0`: usa `tokens`
  - senão: usa `[normalizedQuery]` como fallback

Isso significa:
- Com tokens: busca por múltiplos termos curtos (sem stopwords e com minLength).
- Sem tokens: tenta um fallback com a query normalizada inteira.

#### 4.4.3 Quais campos entram na busca
`searchableFields` é um array com (conceitualmente):

- `name`
- `description`
- `category`
- `manufacturer`
- `tags` (convertido para string via `array_to_string(tags, ' ')`)

Todos passam por:
- `translate(..., ACCENT_FROM, ACCENT_TO)` para remover acentos (forma “SQL-side”)
- `lower(...)`

Resultado: os campos são comparados de forma case-insensitive e accent-insensitive.

#### 4.4.4 Como o WHERE é montado (lógica exata)
Para cada `term` em `terms`, monta-se:

- `likePattern = %term%`
- uma cláusula `OR` com todos os campos: `ilike(field, likePattern)`

Depois:
- todas as cláusulas por `term` são combinadas com `OR` final.

Em pseudo-SQL:

```sql
WHERE status = 'ativo'
  AND (
    (name ILIKE '%term1%' OR description ILIKE '%term1%' OR ... OR tags ILIKE '%term1%')
    OR
    (name ILIKE '%term2%' OR description ILIKE '%term2%' OR ... OR tags ILIKE '%term2%')
    OR ...
  )
LIMIT finalLimit
```

Observação crítica:
- A lógica é **OR entre termos** e **OR entre campos**.
- Isso favorece recall (trazer mais coisas) e delega ordenação “inteligente” para as próximas etapas.

### 4.5 Etapa D — “pontuação lexical” (após SQL)
Depois de obter `lexicalResults` do banco, o sistema os transforma em hits via `mapLexicalResults(lexicalResults, effectiveQuery)`.

Dois modos:

1) `HYBRID_SEARCH_ENHANCED != true` (modo simples)
- `mapLexicalResults` **não calcula** `lexicalScore`.
- O hit lexical entra com `source: "lexical"` e `snippet`.
- A ordem é essencialmente a do banco (não há ranking lexical detalhado).

2) `HYBRID_SEARCH_ENHANCED === true` (modo aprimorado)
- `mapLexicalResults` calcula `lexicalScore` chamando `scoreCatalogItemLexical(effectiveQuery, item)`.
- Ordena os hits lexicais por:
  1. maior `lexicalScore`
  2. desempate pelo índice original (estável)

O `lexicalScore` é explicado na seção 6.

### 4.6 Etapa E — busca vetorial (embeddings)
O pipeline tenta gerar embedding da `effectiveQuery`:

- `embedding = generateCatalogEmbedding(effectiveQuery)`

Se conseguir:
- roda `searchCatalogVector(embedding, effectiveQuery, finalLimit)`

#### 4.6.1 Métrica e threshold
A consulta vetorial calcula uma distância (via pgvector):
- `distance = catalog_item_embeddings.embedding <#> queryEmbedding`

Depois aplica opcionalmente:
- `CATALOG_VECTOR_THRESHOLD` (default -0.5)
- Se finito, filtra: `distance <= threshold`

Observação:
- O comentário indica que valores “menores = melhor”, e exemplos mencionam cos_sim.
- O sistema registra logs do threshold e scores quando há resultados.

Se der erro na query vetorial:
- `fallbackReason = "vector-query-error"`

Se não gerar embedding:
- `fallbackReason = "embedding-generation-failed"` (ou `"embedding-disabled"`)

### 4.7 Etapa F — merge vetorial + lexical
Por fim:
- `results = mergeCatalogResults(vectorResults, lexicalHits, finalLimit)`

Dois modos:

1) `HYBRID_SEARCH_ENHANCED != true`
- Dedupe por `item.id` preservando prioridade:
  1. entra tudo do vetorial primeiro
  2. depois completa com lexical até bater o `limit`

2) `HYBRID_SEARCH_ENHANCED === true`
- Combina sinais (quando o mesmo item aparece em ambas fontes).
- Calcula um score combinado (`computeCombinedScore`) com:
  - componente vetorial normalizado
  - `lexicalScore`
  - bônus de “pair” (cultura + tratamento)
  - bônus por posição/rank (vetorial e lexical)
- Ordena desc e corta no `limit`.

Pesos configuráveis (env):
- `CATALOG_VECTOR_WEIGHT` (default 6)
- `CATALOG_LEXICAL_WEIGHT` (default 4)
- `CATALOG_PAIR_PRIORITY_BONUS` (default 4)

---

## 5) Como o resultado vira “contexto entregue à IA”

### 5.1 Construção do payload textual do catálogo
A função `buildCatalogPayload(query, result)` produz um **string** em português.

- Se não houver resultados: `"Nenhum item do catálogo encontrado ..."`
- Se houver resultados: concatena hits em uma única linha grande, separados por `||`.

Cada hit é formatado por `formatCatalogHit(hit, index)` e inclui:
- `name`, `category`, `manufacturer`
- `price` (ou “preço indisponível”)
- `tags`
- `Fonte`: lexical / vetorial / vetorial+lexical
- `Score`: `vec:...` e/ou `lex:...` quando presente
- `Snippet`: `hit.snippet` (ou descrição)

Essa escolha é importante porque:
- O modelo recebe um “catálogo em texto” com sinais (fonte/score) que ajudam a priorizar.

### 5.2 Onde o payload é anexado
Durante `/api/chat`, o servidor monta `contextSections` (um array de strings) contendo:

- `historySection` (histórico recente)
- opcionalmente `historySummary`
- seção de FAQs (se buscou)
- seção de catálogo (se buscou)

Depois, isso vira um único texto:

- `userAnswerPayload = ["Contexto consolidado...", contextSections.join("\n\n"), "Pergunta do usuário: ..."].join("\n\n")`

E a **segunda chamada ao OpenRouter** recebe:
- `system`: instrução de responder
- `user`: `userAnswerPayload`

### 5.3 Logging/auditoria: o que exatamente foi “entregue”
Sempre que a tool é executada (FAQ ou catálogo), chama-se `logToolPayload({ ... })`.

Isso imprime no terminal:
- nome da tool
- argumentos (JSON)
- `resultCount`
- preview truncado do `aiPayload` (até 800 chars)

Esse log é a forma prática de depurar:
- “o que o banco retornou” (indiretamente)
- “o que foi colocado no contexto final”

---

## 6) Detalhe: como funciona o `lexicalScore` do catálogo

O `lexicalScore` (quando habilitado) tenta medir “quão bem o item casa com a query” com:

- normalização de texto (`normalizeText`)
- extração de tokens (até 8)
- expansão de sinônimos por categoria:
  - culturas (ex.: uva, soja)
  - tratamentos (ex.: fungicida, herbicida)
  - genéricos (ex.: fertilizante)
- pesos diferentes por campo (nome, descrição, tags, etc.)
- bônus por encontrar cultura e/ou tratamento e, especialmente, o par cultura+treatment.

Resumo dos pesos (atual):
- `name`: 3.5
- `description`: 2.5
- `category`: 2
- `manufacturer`: 1.5
- `tags`: 4

Bônus:
- token bateu em algum campo: +0.5
- há pelo menos 1 cultura: +2
- há pelo menos 1 tratamento: +2
- há cultura + tratamento: +5
- cultura encontrada em tag: +1 extra

Saída diagnóstica (`signals`) inclui:
- tokens da query
- tokens que bateram
- em quais campos bateram
- quais culturas/tratamentos foram detectados
- flag `hasCultureTreatmentPair`

---

## 7) Como depurar tool calls do `searchCatalog`

### 7.1 Logs do servidor
Durante a execução, procure por:
- `🔍 [BUSCA] Executando searchCatalogHybrid`
- logs de tempos/contadores (via `logHybridStats`)
- bloco `🧠 [AI CONTEXTO] ... via searchCatalog` (via `logToolPayload`)

Isso responde perguntas como:
- “a tool foi chamada?”
- “quantos resultados vieram?”
- “veio vetorial, lexical, ou ambos?”
- “qual payload foi entregue à IA?”

### 7.2 Script de debug lexical/SQL
O script `scripts/debugCatalogSearch.ts` foi feito para inspecionar:
- tokens extraídos
- em quais campos os tokens aparecem
- o `lexicalScore` por item (quando enhanced)

Ele chama `storage.searchCatalog(query, limit)` (busca lexical SQL) e imprime detalhes.

---

## 8) Variáveis de ambiente relevantes (searchCatalog)

- `HYBRID_SEARCH_ENHANCED`
  - `"true"` habilita pontuação lexical e merge avançado.

- `CATALOG_VECTOR_THRESHOLD`
  - controla o filtro de similaridade vetorial.

- `CATALOG_VECTOR_WEIGHT`, `CATALOG_LEXICAL_WEIGHT`, `CATALOG_PAIR_PRIORITY_BONUS`
  - controlam a composição do ranking no merge avançado.

- `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`
  - necessários para as chamadas ao OpenRouter.

---

## 9) Checklist de consistência (para mudanças futuras)

Quando alterar `searchCatalog`/`searchCatalogHybrid`, revise:

- A) O SQL lexical (campos pesquisáveis, tokenização, OR/AND).
- B) O texto entregue à IA (`buildCatalogPayload`): formato, separadores e densidade.
- C) O merge híbrido: dedupe, pesos, thresholds, fallback.
- D) Logs: garantir que `logToolPayload` continue refletindo fielmente o payload entregue.

<!-- agent-update:end -->
