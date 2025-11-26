## Objetivo
Mapear melhorias para `searchFaqs` que aumentem o recall do RAG quando o usuário usa variações como “cavalo” vs. “cavalos”.

## Observações atuais
- `client/src/pages/chat.tsx` envia a pergunta crua para `/api/chat`; toda a lógica de busca fica no backend.
- `server/routes.ts` só consulta o banco se a LLM usar o tool `searchFaqs`. O texto enviado na tool vira o filtro SQL sem ajustes.
- `server/storage.ts` implementa `searchFaqs` com `ILIKE '%query%'` em `question` ou `answer`, exigindo substring idêntica.
- Não há normalização (lowercase, remover acentos), tokenização, stemming ou fuzzy matching, então plurais/sinônimos falham.

## Opções de melhoria
1. **Normalização + unaccent + tokenização simples**
   - Lowercase, remover pontuação/acentos antes de gerar o padrão de busca tanto para a query quanto para os campos.
   - Dividir pergunta em termos relevantes (remover stopwords) e montar cláusula `AND` com `ILIKE '%termo%'` para cada token.
   - Esforço baixo, sem mudança de schema; melhora casos singular/plural e reordenação parcial.
   - Ajustes em `server/storage.ts` (talvez helper utilitário compartilhado).

2. **Full Text Search nativo do PostgreSQL**
   - Adicionar coluna `tsvector` (ex.: `search_document`) alimentada por `to_tsvector('portuguese', question || ' ' || answer)` e indexar com GIN.
   - Consultar usando `plainto_tsquery('portuguese', query)` e ordenar por `ts_rank`.
   - Necessita migração e atualização de inserts/updates para manter `tsvector` síncrono.
   - Entrega stemming, stopwords e ranking nativo.

3. **pg_trgm (trigram similarity)**
   - Habilitar extensão `pg_trgm`, criar índice GIN/GIST em `question` e `answer`.
   - Usar `similarity(question, query)` ou `<->` para ordenar; aceitar resultados acima de limiar.
   - Tolerante a typos e termos parecidos; não exige pré-processamento complexo.
   - Requer migração para ativar extensão e possivelmente `orderBy` com expressão raw no Drizzle.

4. **Fallback automático no backend**
   - Mesmo que a LLM não invoque o tool, rodar uma busca curta no backend (ex.: obrigar primeira consulta) e anexar resultados ao prompt.
   - Garante tentativa de RAG em perguntas curtas sem depender 100% do modelo.
   - Requer ajuste em `server/routes.ts` antes de chamar o modelo ou como fallback se a tool não for chamada.

5. **Busca semântica com embeddings (pgvector ou serviço externo)**
   - Armazenar embedding de `question`/`answer` em coluna `vector`; ao receber pergunta, gerar embedding e fazer `ORDER BY question_embedding <#> query_embedding LIMIT n`.
   - Alta precisão para paráfrases e contexto amplo.
   - Maior esforço: precisa de pipeline de geração (sincrono ou offline), armazenamento e dependência em modelo de embedding.

## Perguntas em aberto
- Ambiente permite extensões (`unaccent`, `pg_trgm`, `pgvector`)?
- Volume esperado de FAQs e requisitos de latência?
- Há etapa de ingestão/curadoria onde podemos pré-computar campos (normalizado, embeddings)?
- Devemos tornar a consulta ao banco obrigatória (independente da LLM) para reduzir misses?
