<!-- agent-update:tool-calls -->
# Tool Calls (RAG) — Documentação Técnica

Este documento descreve **de forma detalhada e operacional** como o backend executa “tool calls” (chamadas a ferramentas internas) para enriquecer a resposta da IA com dados do banco (RAG) e como essas etapas aparecem nos logs.

> Importante: neste repositório, “tool call” **não** é o mesmo que “function calling nativo” do modelo.
> Aqui, “tool call” significa: **o servidor decide e executa uma ferramenta interna (ex.: `searchCatalogHybrid`) e injeta o resultado no contexto da segunda chamada ao OpenRouter**.

---

## 1) O que é uma “tool call” neste projeto

### 1.1 Definição
Uma *tool call* é uma etapa controlada pelo servidor, usada para:

1. **Consultar fontes externas** (principalmente Postgres via Drizzle) para coletar contexto; e/ou
2. **Converter esse resultado em texto** que a IA consiga usar; e
3. **Entregar esse texto à IA** na mensagem final (sem mencionar a “seção de contexto”).

Observação:
- Além das tool calls “RAG” (catálogo/FAQ), existe também uma tool call de **assistência de cadastro** que chama o LLM para sugerir campos faltantes (`catalog-ai-helper`). Ela não consulta o banco; serve para acelerar o preenchimento do catálogo.

### 1.2 Onde aparece no código
- Planejamento de tools por intenção: `planSearches(intent)`
- Execução das tools de RAG (busca catálogo/FAQ): dentro do handler `POST /api/chat`
- Formatação do payload que vai para a IA: `buildCatalogPayload(...)` e construção do contexto de FAQ dentro do handler
- Auditoria (log do conteúdo entregue à IA): `logToolPayload(...)`
- Tool call de assistência de cadastro: `POST /api/catalog/assist` → `generateCatalogSuggestions(...)`

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
2. (Opcional) **Resumo do histórico** via OpenRouter (`summarizeHistory`): cria `summary` e pode sugerir `catalogQuery` (palavras-chave).
3. **Chamada 1 ao OpenRouter (classificação)**: identifica a intenção do usuário (podendo usar o `summary` como contexto).
4. Deriva `queryContext` do histórico recente (pequeno texto com as últimas mensagens) para enriquecer buscas — hoje aplicado **apenas em FAQ**.
5. Planeja quais tools executar (`planSearches`).
6. Executa tool calls planejadas:
   - `searchFaqsHybrid` (quando aplicável)
   - `searchCatalogHybrid` (quando aplicável)
7. Constrói `contextSections` consolidado (histórico + resultados de tools).
8. **Chamada 2 ao OpenRouter (resposta final)** sem tools: entrega o contexto consolidado e a pergunta.

Observações:
- O campo `debug.llmCalls` retornado pelo endpoint reflete apenas o planejamento (`planSearches`) e **não** contabiliza as duas chamadas do chat (resumo/classificação/resposta).
- As tool calls de RAG (FAQ/Catálogo) acontecem no passo 6.

---

## 3) Tool calls disponíveis (RAG + assist)

### 3.1 Nomes “externos” (logs/planejamento)
- `searchFaqs` — consulta FAQ (RAG)
- `searchCatalog` — consulta catálogo (RAG)
- `catalog-ai-helper` — assistência de cadastro (LLM estruturado; não-RAG)

### 3.2 `searchFaqs` (FAQ RAG)
Onde é chamada:
- `POST /api/chat`
- Condição: `planSearches(intent).runFaq === true`
- Execução: `storage.searchFaqsHybrid(userMessage, resolvedLimit, { queryContext })`

O que vai para o contexto final:
- O handler monta uma seção: `FAQs relevantes (N): ...`
- Cada FAQ entra como `Q: ... | A: ...`, com separador `||` entre itens.

Logs:
- O `logToolPayload` registra `toolName: "searchFaqs"` e `aiPayload` com o texto de FAQs (sem o prefixo da seção).

### 3.3 `searchCatalog` (Catálogo RAG)
Existem dois caminhos principais:

1) **Chat RAG (principal)**
- Endpoint: `POST /api/chat`
- Condição: `planSearches(intent).runCatalog === true`
- Execução: chama `storage.searchCatalogHybrid(catalogSearchQuery, resolvedLimit)`, onde:
  - Por padrão: `catalogSearchQuery = userMessage`
  - Opcional: quando `CATALOG_QUERY_KEYWORDS_ENABLED=true` e o resumo automático gerou `catalogQuery`, usa `catalogSearchQuery = catalogQuery` (fallback continua sendo `userMessage`)

2) **Busca direta de RAG (debug/API)**
- Endpoint: `POST /api/rag/search`
- Execução: chama `storage.searchCatalogHybrid(query, resolvedLimit)`

O foco principal deste documento é o comportamento do `storage.searchCatalogHybrid(...)` e como seu resultado é transformado em contexto.

### 3.4 `catalog-ai-helper` (assistência de cadastro)
- Endpoint: `POST /api/catalog/assist`
- Objetivo: sugerir `description`, `category`, `price` e/ou `tags` quando estão vazios no formulário
- Execução: `generateCatalogSuggestions(...)` (gera um objeto estruturado via OpenRouter + `generateObject`)
- Logs: registra `toolName: "catalog-ai-helper"` com `aiPayload` igual ao `prompt` usado (para auditoria)

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
O pipeline lexical começa consultando o banco via `searchCatalog(effectiveQuery, limit)`.

Observação importante (modo aprimorado):
- Quando `HYBRID_SEARCH_ENHANCED=true`, o `searchCatalogHybrid` busca **mais candidatos lexicais** do que o `finalLimit` (para permitir re-ranking por `lexicalScore`).
- O limite de candidatos é controlado por:
  - `CATALOG_LEXICAL_CANDIDATE_MULTIPLIER` (default 6)
  - `CATALOG_LEXICAL_CANDIDATE_MAX` (default 200)
- Na prática, o SQL recebe algo como: `limit = max(finalLimit, lexicalCandidateLimit)`.

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

#### 4.4.5 Como o SQL ordena os resultados (ranking “base”)
Mesmo no modo simples (sem `lexicalScore`), o SQL já retorna itens ordenados por um ranking básico:

- `searchRank = buildCatalogSearchRank(query)`:
  - para cada `term`, calcula `CASE WHEN (term bate em qualquer campo) THEN 1 ELSE 0 END`
  - soma esses `1/0`, resultando em “quantos termos bateram”
- `ORDER BY desc(searchRank), desc(createdAt)`

Isso tende a priorizar itens que casam com mais termos e, em empate, itens mais recentes.

### 4.5 Etapa D — “pontuação lexical” (após SQL)
Depois de obter `lexicalResults` do banco, o sistema os transforma em hits via `mapLexicalResults(lexicalResults, effectiveQuery)`.

Dois modos:

1) `HYBRID_SEARCH_ENHANCED != true` (modo simples)
- `mapLexicalResults` **não calcula** `lexicalScore`.
- O hit lexical entra com `source: "lexical"` e `snippet`.
- A ordem preserva o `ORDER BY` do SQL (ver seção 4.4.5): há ranking por “quantos termos bateram” (`buildCatalogSearchRank`) e desempate por `createdAt`.

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

#### 4.6.2 Pool de candidatos e snippets (vetorial)
A busca vetorial consulta embeddings por “chunk” (ex.: descrição + arquivos do item) e depois **agrega por item**.

Controles principais (env):
- `CATALOG_VECTOR_CANDIDATE_MULTIPLIER` (default 6) e `CATALOG_VECTOR_CANDIDATE_MAX` (default 200):
  - definem quantos *chunks* podem ser trazidos do banco antes do dedupe por item.
- `CATALOG_VECTOR_CHUNKS_PER_ITEM` (default 1):
  - máximo de snippets distintos agregados por item (ex.: junta trechos com `…`).
- `CATALOG_VECTOR_SNIPPET_MAX_CHARS` (default 800):
  - limite de caracteres do snippet agregado por item (trunca com `…`).

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
- No modo enhanced, hits vetoriais também recebem `lexicalScore`/`lexicalSignals` (calculados por `scoreCatalogItemLexical`) para permitir ranking consistente mesmo quando o item só aparece no vetorial.
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

### 4.8 `searchFaqsHybrid` (FAQ RAG): visão operacional
Embora o foco do detalhamento acima seja o catálogo, a tool de FAQ segue um pipeline bem parecido.

Entrada:
- `query: string`
- `limit: number`
- `options?: { queryContext?: string }`

Etapas principais:
1. **Query + contexto**: `effectiveQuery = combineQueryWithContext(query, queryContext, maxLength=1200)`
   - Ao contrário do catálogo, FAQ **concatena** `queryContext` (quando fornecido).
2. **Lexical (SQL)**:
   - Normaliza FAQs em `questionNormalized` (lazy, via `ensureFaqQuestionNormalization()`).
   - Tokens: `extractSearchTokens(effectiveQuery)`; se não houver tokens, cai em fallback por `normalizedQuery`.
   - Campos consultados: `faqs.questionNormalized` e `faqs.answer` (com `ILIKE`), combinando tokens com `OR`.
3. **Vetorial (pgvector)**:
   - Gera embedding com `generateCatalogEmbedding(effectiveQuery)` (gerador compartilhado).
   - Consulta `faq_embeddings.embedding <#> queryEmbedding` e aplica `FAQ_VECTOR_THRESHOLD` (default -0.5) quando finito.
4. **Merge**:
   - Usa `mergeFaqResults(vectorResults, lexicalHits, finalLimit)`.
   - Se `HYBRID_SEARCH_ENHANCED=true`, também considera `FAQ_VECTOR_WEIGHT` e `FAQ_LEXICAL_WEIGHT` para score combinado.

Chave de compatibilidade:
- Se `FAQ_HYBRID_ENABLED=false`, `storage.searchFaqs(...)` desliga o híbrido e executa apenas o lexical (ainda usando `effectiveQuery` com `queryContext`).

---

## 5) Como o resultado vira “contexto entregue à IA”

### 5.1 Construção do payload textual (catálogo e FAQ)

#### 5.1.1 FAQ
No `POST /api/chat`, quando `searchFaqs` roda, o handler constrói um `faqContext` em texto:
- Se houver resultados: itens no formato `Q: ... | A: ...`, separados por `||`
- Se não houver resultados: `"Nenhuma FAQ relevante encontrada."`

E empacota isso na seção:
- `FAQs relevantes (N): ${faqContext}`

#### 5.1.2 Catálogo
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

Detalhe por tool:
- `searchFaqs`: o `aiPayload` logado é o `faqContext` (sem o prefixo `FAQs relevantes (N):`).
- `searchCatalog`: o `aiPayload` logado é o `buildCatalogPayload(...)` completo (inclui o prefixo `Busca híbrida ...`).
- `catalog-ai-helper`: o `aiPayload` logado é o `prompt` usado para gerar sugestões.

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

## 7) Como depurar tool calls (RAG + assist)

### 7.1 Logs do servidor
Durante a execução, procure por:
- `🔍 [BUSCA] Executando searchCatalogHybrid`
- `🔍 [BUSCA] Executando searchFaqsHybrid`
- logs de tempos/contadores (via `logHybridStats`)
- logs de tempos/contadores (FAQ) (via `logFaqHybridStats`)
- bloco `🧠 [AI CONTEXTO] ... via searchCatalog` (via `logToolPayload`)
- bloco `🧠 [AI CONTEXTO] ... via searchFaqs` (via `logToolPayload`)
- bloco `🧠 [AI CONTEXTO] ... via catalog-ai-helper` (via `logToolPayload`)

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

Scripts úteis relacionados:
- `scripts/debugCatalogHybrid.ts` / `scripts/debugCatalogHybridLive.ts` — inspecionam resultado híbrido (vetorial+lexical) e stats.
- `scripts/debugCatalogVector.ts` — inspeciona apenas a busca vetorial do catálogo.
- `scripts/debugFaqHybrid.ts` — inspeciona o híbrido de FAQ.

---

## 8) Variáveis de ambiente relevantes (tool calls)

- `HYBRID_SEARCH_ENHANCED`
  - `"true"` habilita pontuação lexical e merge avançado.

- `FAQ_HYBRID_ENABLED`
  - `"false"` desliga o modo híbrido de FAQ e usa apenas o lexical.

- `FAQ_VECTOR_THRESHOLD`
  - controla o filtro de similaridade vetorial das FAQs.

- `FAQ_VECTOR_WEIGHT`, `FAQ_LEXICAL_WEIGHT`
  - pesos do merge avançado de FAQ (quando `HYBRID_SEARCH_ENHANCED=true`).

- `CATALOG_VECTOR_THRESHOLD`
  - controla o filtro de similaridade vetorial do catálogo.

- `CATALOG_VECTOR_CANDIDATE_MULTIPLIER`, `CATALOG_VECTOR_CANDIDATE_MAX`
  - controlam quantos *chunks* vetoriais são buscados antes do dedupe por item.

- `CATALOG_VECTOR_CHUNKS_PER_ITEM`, `CATALOG_VECTOR_SNIPPET_MAX_CHARS`
  - controlam a agregação/truncamento de snippets vetoriais por item.

- `CATALOG_LEXICAL_CANDIDATE_MULTIPLIER`, `CATALOG_LEXICAL_CANDIDATE_MAX`
  - controlam quantos candidatos lexicais são buscados no modo aprimorado.

- `CATALOG_VECTOR_WEIGHT`, `CATALOG_LEXICAL_WEIGHT`, `CATALOG_PAIR_PRIORITY_BONUS`
  - controlam a composição do ranking no merge avançado do catálogo.

- `CATALOG_QUERY_KEYWORDS_ENABLED`
  - `"true"` habilita usar `catalogQuery` (do resumo automático) como query de busca no catálogo.

- `OPENROUTER_API_KEY`, `OPENROUTER_SITE_URL`, `OPENROUTER_SITE_NAME`
  - necessários para as chamadas ao OpenRouter.

- `OPENROUTER_MODEL_CLASSIFY`, `OPENROUTER_MODEL_CLASSIFY_FALLBACK`, `OPENROUTER_MODEL_ANSWER`
  - modelos usados no chat (classificação e resposta).

- `CHAT_HISTORY_CONTEXT_LIMIT`
  - controla quantas mensagens entram no histórico recente (contexto textual enviado ao LLM).

- `CATALOG_AI_MODEL`, `CATALOG_AI_MAX_PRICE`
  - controlam a tool `catalog-ai-helper` (`POST /api/catalog/assist`).

---

## 9) Checklist de consistência (para mudanças futuras)

Quando alterar tool calls, revise:

- A) O SQL lexical (campos pesquisáveis, tokenização, OR/AND) em FAQ e catálogo.
- B) O texto entregue à IA (seções e separadores): densidade, ordem e limites de tamanho.
- C) O merge híbrido: dedupe, pesos, thresholds, fallback (FAQ e catálogo).
- D) Logs: garantir que `logToolPayload` continue refletindo fielmente o payload entregue.

<!-- agent-update:end -->
