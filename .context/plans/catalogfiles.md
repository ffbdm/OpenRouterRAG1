---
id: plan-catalogfiles
ai_update_goal: "Define the stages, owners, and evidence required to complete Catalogfiles."
required_inputs:
  - "Task summary or issue link describing the goal"
  - "Relevant documentation sections from docs/README.md"
  - "Matching agent playbooks from agents/README.md"
success_criteria:
  - "Stages list clear owners, deliverables, and success signals"
  - "Plan references documentation and agent resources that exist today"
  - "Follow-up actions and evidence expectations are recorded"
related_agents:
  - "code-reviewer"
  - "bug-fixer"
  - "feature-developer"
  - "refactoring-specialist"
  - "test-writer"
  - "documentation-writer"
  - "performance-optimizer"
  - "security-auditor"
  - "backend-specialist"
  - "frontend-specialist"
  - "architect-specialist"
  - "devops-specialist"
  - "database-specialist"
  - "mobile-specialist"
---

<!-- agent-update:start:plan-catalogfiles -->
# Catalogfiles Plan

> Objetivo: evitar que embeddings de anexos (`source="file"`) ditem o ranking do catálogo, mas ainda permitir usar anexos para enriquecer a resposta quando o usuário pedir informações típicas de documentos (bula/FISPQ/tabela/ppm/pdf/anexo).
>
> Problema atual:
> - `server/storage.ts#searchCatalogVector` consulta `catalog_item_embeddings` sem filtrar `source`, então trechos de anexos entram no ranking junto com `source="item"`/`"note"`.
> - Resultado: o ranking/snippet do híbrido pode refletir o PDF/anexo em vez do item (descrição/tags/etc).
>
> Estratégia proposta (2 passadas + gating por intenção):
> 1) **Ranking principal (híbrido)**: na busca vetorial principal, filtrar por `source in ("item") e **excluir** `source="file"`. A busca lexical de itens continua igual.
> 2) **Enriquecimento por anexos (opcional)**: após obter o top-N itens pelo híbrido principal, executar uma segunda query vetorial restrita a `catalogItemId IN (topN)` e `source="file"` para obter os melhores trechos de anexos por item. Esses trechos entram apenas como contexto/snippet (não alteram o ranking).
> 3) **Gatilho por intenção**: estender a classificação para retornar `{ intent, useCatalogFiles }` e só rodar a etapa (2) quando `useCatalogFiles=true` (ex.: “bula”, “FISPQ”, “ficha técnica”, “composição”, “dose”, “ppm”, “tabela”, “pdf”, “anexo”, “arquivo”…).

## Task Snapshot
- **Primary goal:** Separar “ranking do catálogo” (baseado no item) de “trechos de anexos” (enriquecimento opcional), para reduzir ruído/custo e melhorar consistência do RAG.
- **Success signal:** Para perguntas de produto “gerais”, o top-N do catálogo deixa de ser dominado por embeddings de anexos; para perguntas documentais, o chat retorna trechos relevantes de anexos sem mudar o ranking do item; logs e `debug` exibem claramente quando anexos foram consultados; latência/custo permanecem sob controle.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)
  - Fonte do problema: `server/storage.ts#searchCatalogVector`, `shared/schema.ts#catalogItemEmbeddingSources`
  - Construção do contexto: `server/routes.ts#buildCatalogPayload`
  - Upload/preview de anexos: `server/catalog-routes.ts`, `server/catalog-file-preview.ts`
  - Scripts úteis: `scripts/debugCatalogHybridLive.ts`, `scripts/seedCatalogEmbeddings.ts`

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que o “2-pass retrieval” não altera contrato do chat sem necessidade, e que filtros/flags estão bem documentados. | [Code Reviewer](../agents/code-reviewer.md) | Revisar mudanças em `searchCatalogVector` e no payload do chat |
| Bug Fixer | Triage rápido de regressões: ranking “sumiu”, anexos não aparecem quando deveriam, ou ruído no snippet. | [Bug Fixer](../agents/bug-fixer.md) | Reproduzir com queries reais e validar logs/híbrido |
| Feature Developer | Implementar o filtro de `source` no ranking e o enriquecimento por anexos restrito ao top-N. | [Feature Developer](../agents/feature-developer.md) | Codar 2ª query (source=file) e integrar no fluxo de chat |
| Refactoring Specialist | Evitar duplicação: extrair utilitários de busca vetorial (filtros, thresholds, dedupe por item). | [Refactoring Specialist](../agents/refactoring-specialist.md) | Deixar `storage.ts` coeso e legível |
| Test Writer | Definir testes determinísticos para: (a) filtro por `source`, (b) gating por `useCatalogFiles`, (c) limites de contexto. | [Test Writer](../agents/test-writer.md) | Introduzir `*.test.ts` onde fizer sentido (mocks de DB/embeddings) |
| Documentation Writer | Atualizar docs do fluxo para explicar quando anexos entram no contexto e como controlar via env/flags. | [Documentation Writer](../agents/documentation-writer.md) | Atualizar `docs/data-flow.md` e notas de configuração |
| Performance Optimizer | Medir impacto de 2ª query (latência + custo) e calibrar `topN`/`chunksPerItem`/limites. | [Performance Optimizer](../agents/performance-optimizer.md) | Baseline antes/depois e recomendações de defaults |
| Security Auditor | Revisar logs/payload para evitar vazamento de conteúdo sensível de anexos e garantir truncation. | [Security Auditor](../agents/security-auditor.md) | Checar limites e redactions nos logs do chat |
| Backend Specialist | Dono do design final: filtros, assinatura de APIs internas e integração no `/api/chat`. | [Backend Specialist](../agents/backend-specialist.md) | Executar mudanças em `server/` e scripts de suporte |
| Frontend Specialist | Confirmar que o contrato de resposta do chat e UI de catálogo/arquivos não quebram; ajustar debug UI se necessário. | [Frontend Specialist](../agents/frontend-specialist.md) | Validar impacto no `client/` e experiência do chat |
| Architect Specialist | Definir a estratégia de “ranking vs enrichment” e os parâmetros configuráveis; decidir `item` vs `item+note`. | [Architect Specialist](../agents/architect-specialist.md) | Aprovar o desenho do 2-pass e do gating |
| Devops Specialist | Garantir rollout seguro: defaults seguros, flags, e observabilidade em staging/produção. | [Devops Specialist](../agents/devops-specialist.md) | Documentar env vars e plano de rollback por flag |
| Database Specialist | Avaliar performance/índices para `source` e consultas por `catalogItemId IN (...)`; sugerir ajustes se necessário. | [Database Specialist](../agents/database-specialist.md) | Validar plano de query e índices no Postgres |
| Mobile Specialist | Confirmar retrocompatibilidade do payload e que mudanças são transparentes para clientes futuros. | [Mobile Specialist](../agents/mobile-specialist.md) | Checar impacto no contrato `/api/chat` |

## Documentation Touchpoints
| Guide | File | Task Marker | Primary Inputs |
| --- | --- | --- | --- |
| Project Overview | [project-overview.md](../docs/project-overview.md) | agent-update:project-overview | Roadmap, README, stakeholder notes |
| Architecture Notes | [architecture.md](../docs/architecture.md) | agent-update:architecture-notes | ADRs, service boundaries, dependency graphs |
| Development Workflow | [development-workflow.md](../docs/development-workflow.md) | agent-update:development-workflow | Branching rules, CI config, contributing guide |
| Testing Strategy | [testing-strategy.md](../docs/testing-strategy.md) | agent-update:testing-strategy | Test configs, CI gates, known flaky suites |
| Glossary & Domain Concepts | [glossary.md](../docs/glossary.md) | agent-update:glossary | Business terminology, user personas, domain rules |
| Data Flow & Integrations | [data-flow.md](../docs/data-flow.md) | agent-update:data-flow | System diagrams, integration specs, queue topics |
| Security & Compliance Notes | [security.md](../docs/security.md) | agent-update:security | Auth model, secrets management, compliance requirements |
| Tooling & Productivity Guide | [tooling.md](../docs/tooling.md) | agent-update:tooling | CLI scripts, IDE configs, automation workflows |

## Risk Assessment
Identify potential blockers, dependencies, and mitigation strategies before beginning work.

### Identified Risks
| Risk | Probability | Impact | Mitigation Strategy | Owner |
| --- | --- | --- | --- | --- |
| `source="item"` insuficiente (itens sem embeddings atualizados) levando a queda de recall | Medium | High | Rodar `scripts/seedCatalogEmbeddings.ts`, validar contagem por `source`, e manter fallback lexical; opcionalmente permitir `("item","note")` | Backend Specialist / Database Specialist |
| Classificação errar `useCatalogFiles` (anexos não entram quando deveriam) | Medium | Medium | Heurística robusta no prompt + fallback manual (ex.: “se a pergunta contém ‘pdf/anexo/fispq’”), e telemetria via logs/debug | Architect Specialist / Bug Fixer |
| Latência/custo por 2ª query e aumento de tokens no contexto | Medium | Medium | Limitar top-N e chunks por item; truncar trechos; execução somente quando `useCatalogFiles=true`; medir p95 e ajustar defaults | Performance Optimizer |
| Vazamento acidental de conteúdo sensível de anexos via logs | Low | High | Truncation agressiva no logging, nunca logar anexos completos, e revisar `logToolPayload`/SSE | Security Auditor |

### Dependencies
- **Internal:** `server/storage.ts` (busca híbrida), `server/routes.ts` (orquestração do chat), `shared/schema.ts` (enum `source`), `server/catalog-file-preview.ts` (texto de anexos).
- **External:** OpenRouter (embeddings e chat), Postgres/pgvector (consulta vetorial), Vercel Blob (armazenamento; não afeta o ranking, mas afeta disponibilidade de anexos).
- **Technical:** Índices existentes em `catalog_item_embeddings` (por item/source/chunk); limites configuráveis para chunks/snippets; feature flag para ligar/desligar enriquecimento.

### Assumptions
- A maioria dos itens tem pelo menos um embedding `source="item"` atualizado (ou é possível backfill antes de habilitar em produção).
- `source="note"` (se usado) é complementar e não deve dominar o ranking; se houver ruído, restringir para apenas `"item"`.
- Se alguma suposição falhar (ex.: muitos itens sem `item` embedding), manter o comportamento antigo atrás de uma flag e priorizar backfill/melhorias de seed.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1 person-day | 1-2 days | 1 person |
| Phase 2 - Implementation | 3 person-days | ~1 week | 1-2 people |
| Phase 3 - Validation | 2 person-days | 2-3 days | 1-2 people |
| **Total** | **6 person-days** | **~2 semanas** | **-** |

### Required Skills
- TypeScript/Node.js (Express) no `server/`
- Drizzle ORM + Postgres/pgvector (queries com filtros/`IN`)
- RAG híbrido (merge, thresholds, snippets) e controle de contexto/tokens
- Prompting (classificação em JSON schema) e observabilidade via logs/SSE

### Resource Availability
- **Available:** Backend Specialist (principal), Database Specialist (consulta/índices), Performance Optimizer (calibração).
- **Blocked:** Nenhum bloqueio identificado; depende de janela para backfill de embeddings se necessário.
- **Escalation:** Architect Specialist para decisões de design (ex.: fontes permitidas, payload final).

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Backend Specialist + Database Specialist: levantar estado atual (contagem de embeddings por `source`, exemplos de queries onde anexos dominam o ranking) usando logs e/ou `scripts/debugCatalogHybridLive.ts`.
2. Architect Specialist: decidir quais fontes entram no ranking vetorial principal (`"item"` vs `("item","note")`) e definir limites/defaults para enriquecimento (`topN`, `chunksPerItem`, `maxChars`).
3. Backend Specialist: definir contrato do gating (`useCatalogFiles`) e lista inicial de gatilhos (palavras-chave) no prompt de classificação + fallback heurístico simples (se necessário).

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Backend Specialist: aplicar filtro por `source` no ranking vetorial principal (em `server/storage.ts#searchCatalogVector`) e manter logs claros (ex.: `VECTOR sources=item,note`).
2. Feature Developer: adicionar busca vetorial de anexos restrita ao top-N (ex.: `searchCatalogFilesVector({ itemIds, query, chunksPerItem })`) com truncation e retorno estruturado por item/arquivo.
3. Backend Specialist: integrar no `server/routes.ts` (após `searchCatalogHybrid`), enriquecendo o payload/contexto sem alterar ranking; guardar sinais em `debug` (ex.: `catalogFilesUsed`, `catalogFilesCount`).
4. Backend Specialist + Architect Specialist: estender schema de classificação para `{ intent, useCatalogFiles }` (JSON schema) e atualizar `system_instructions.buscar-dados` / `server/instruction-defaults.ts` para instruir o modelo a preencher o boolean corretamente.
5. Test Writer (se aplicável): adicionar testes determinísticos para (a) não incluir `source=file` no ranking principal, (b) só enriquecer quando `useCatalogFiles=true`, (c) respeitar limites de tamanho de snippets.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Performance Optimizer: medir latência (p95) de `/api/chat` com e sem enriquecimento por anexos; ajustar limites/defaults para não estourar contexto.
2. Bug Fixer: rodar bateria manual de queries (gerais vs documentais) e confirmar: ranking do item estável + anexos aparecem quando pedido.
3. Documentation Writer: atualizar `docs/data-flow.md` e notas de configuração (novas env vars/flags e comportamento de 2-pass).
4. Code Reviewer: revisão final de segurança (logs), legibilidade e consistência de payload.

**Commit Checkpoint**
- Record the validation evidence and create a commit signalling the handoff completion (for example, `git commit -m "chore(plan): complete phase 3 validation"`).

## Rollback Plan
Document how to revert changes if issues arise during or after implementation.

### Rollback Triggers
When to initiate rollback:
- Critical bugs affecting core functionality
- Performance degradation beyond acceptable thresholds
- Data integrity issues detected
- Security vulnerabilities introduced
- User-facing errors exceeding alert thresholds

### Rollback Procedures
#### Phase 1 Rollback
- Action: Discard discovery branch, restore previous documentation state
- Data Impact: None (no production changes)
- Estimated Time: < 1 hour

#### Phase 2 Rollback
- Action: Desabilitar enriquecimento por anexos via flag (se existir) e/ou reverter commits que adicionaram a 2ª query; opcionalmente retornar o filtro de `source` ao comportamento antigo temporariamente.
- Data Impact: Nenhuma migração obrigatória; no máximo mudanças de logs/telemetria. Conteúdo de anexos/embeddings permanece intacto.
- Estimated Time: 30-60 minutos (via revert + deploy) ou imediato (via flag).

#### Phase 3 Rollback
- Action: Rollback de deploy para versão anterior (sem 2-pass), mantendo anexos no catálogo.
- Data Impact: Nenhum (somente comportamento de recuperação/contexto).
- Estimated Time: 30-60 minutos.

### Post-Rollback Actions
1. Document reason for rollback in incident report
2. Notify stakeholders of rollback and impact
3. Schedule post-mortem to analyze failure
4. Update plan with lessons learned before retry

<!-- agent-readonly:guidance -->
## Agent Playbook Checklist
1. Pick the agent that matches your task.
2. Enrich the template with project-specific context or links.
3. Share the final prompt with your AI assistant.
4. Capture learnings in the relevant documentation file so future runs improve.

## Evidence & Follow-up
- Artefatos:
  - Logs do chat mostrando: (a) ranking vetorial sem `source=file`, (b) execução condicional do enrichment com `useCatalogFiles=true`, (c) tempos/contagens (vetorial/lexical/enrichment).
  - Capturas (ou texto) de 2-3 queries “gerais” e 2-3 queries “documentais”, com comparação do top-N antes/depois (ao menos em staging).
  - PR link(s) e checklist de revisão (segurança + performance).
  - Se houver, saída de `npm run check` e logs de deploy.
- Follow-ups:
  - Calibrar lista de gatilhos de `useCatalogFiles` com feedback de uso real (Owner: Architect Specialist).
  - Avaliar necessidade de índice adicional/otimização caso o enrichment fique caro em produção (Owner: Database Specialist / Performance Optimizer).

<!-- agent-update:end -->
