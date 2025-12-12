---
id: plan-hibrid-faq
ai_update_goal: "Define the stages, owners, and evidence required to complete Hibrid Faq."
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

<!-- agent-update:start:plan-hibrid-faq -->
# Hibrid Faq Plan

> Tornar a busca de FAQs híbrida (lexical + vetorial), no mesmo padrão de `searchCatalogHybrid`, para melhorar recall em perguntas parafraseadas e reduzir “zero results”, mantendo fallback lexical quando embeddings estiverem indisponíveis.

## Task Snapshot
- **Primary goal:** Implementar busca híbrida para FAQs no backend (`server/`), adicionando embeddings em Postgres/pgvector e uma rotina de merge vetorial+lexical para o `searchFaqs`, sem quebrar o fluxo atual de `/api/chat`.
- **Success signal:** Consultas de FAQ com variações semânticas retornam respostas relevantes; `/api/chat` usa o híbrido com logs de estatísticas (vetorial/lexical/fallback); latência p95 não piora mais que ~200ms em dev/staging; fallback lexical funciona sem `OPENROUTER_API_KEY`; docs e migrações atualizadas.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)
  - Plano base de híbrido do catálogo: `plans/rag-system-hybrid-design.md`
  - Implementação referência: `server/storage.ts#searchCatalogHybrid`, `server/catalog-hybrid.ts`

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Revisar PRs do híbrido de FAQ para aderência ao padrão do catálogo, TS estrito e estilo do repo. | [Code Reviewer](../agents/code-reviewer.md) | Revisar proposta de schema/migração e API híbrida |
| Bug Fixer | Apoiar correções de regressão após integrar o híbrido no fluxo do chat. | [Bug Fixer](../agents/bug-fixer.md) | Analisar logs de queries sem resultados e erros vetoriais |
| Feature Developer | Implementar a camada híbrida de FAQ e scripts de backfill/debug. | [Feature Developer](../agents/feature-developer.md) | Prototipar `searchFaqsHybrid` e merge vetorial+lexical |
| Refactoring Specialist | Reduzir duplicação com o híbrido do catálogo e manter `storage.ts` coeso. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Avaliar reaproveitamento/extração de utilitários híbridos |
| Test Writer | Criar testes determinísticos para merge, fallback e contrato de resposta. | [Test Writer](../agents/test-writer.md) | Cobrir casos com embeddings desligados/erro de vetor |
| Documentation Writer | Atualizar README e `.context/docs/*` com o novo fluxo híbrido de FAQ. | [Documentation Writer](../agents/documentation-writer.md) | Atualizar diagramas e env vars na docs |
| Performance Optimizer | Medir impacto de embeddings na `/api/chat` e ajustar thresholds/pesos/caches. | [Performance Optimizer](../agents/performance-optimizer.md) | Baseline de latência e qualidade antes/depois |
| Security Auditor | Auditar queries e logs para evitar vazamento de dados/segredos e injeções. | [Security Auditor](../agents/security-auditor.md) | Revisar migração pgvector e uso de `OPENROUTER_API_KEY` |
| Backend Specialist | Liderar mudanças em `server/` (storage, módulos híbridos, rotas). | [Backend Specialist](../agents/backend-specialist.md) | Definir estrutura final e integrar no chat |
| Frontend Specialist | Validar que payload e UX do chat permanecem coerentes sem mudanças de UI. | [Frontend Specialist](../agents/frontend-specialist.md) | Revisar contrato da resposta do chat no client |
| Architect Specialist | Definir o design do híbrido de FAQ (assinaturas, tipos, merge, toggle). | [Architect Specialist](../agents/architect-specialist.md) | Decidir estratégia: upgrade de `searchFaqs` vs `searchFaqsHybrid` |
| Devops Specialist | Garantir execução de migrações e backfill em staging/produção. | [Devops Specialist](../agents/devops-specialist.md) | Documentar/automatizar seeds e rollback via env |
| Database Specialist | Criar tabelas/índices de embeddings de FAQ e orientar backfill. | [Database Specialist](../agents/database-specialist.md) | Propor `faq_embeddings` em `shared/schema.ts` + migration |
| Mobile Specialist | Confirmar retrocompatibilidade para clientes futuros. | [Mobile Specialist](../agents/mobile-specialist.md) | Checar se mudanças não alteram o contrato público |

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
| Latência/custo de geração de embeddings em tempo real | Medium | High | Cache em `server/embeddings.ts`, geração async para FAQs novas, thresholds configuráveis e fallback lexical | Performance Optimizer / Backend Specialist |
| FAQs existentes sem embeddings (necessidade de backfill) | High | Medium | Script `scripts/seedFaqEmbeddings.ts` e rotina manual antes de habilitar em produção | Database Specialist |
| Busca vetorial com ruído/baixa precisão | Medium | Medium | Ajustar `FAQ_VECTOR_THRESHOLD`, pesos híbridos e validar com conjunto de queries de QA | Architect Specialist |

### Dependencies
- **Internal:** Infra de embeddings existente (`server/embeddings.ts`), padrão de merge híbrido (`server/catalog-hybrid.ts`), logging (`logHybridStats`).
- **External:** Endpoint de embeddings da OpenRouter (modelo `text-embedding-3-small` ou `EMBEDDING_MODEL`).
- **Technical:** Postgres com pgvector habilitado (já usado pelo catálogo), Drizzle migrations e `npm run db:push`.

### Assumptions
- Dimensões de embedding usadas no catálogo (1536 ou `EMBEDDING_DIMENSIONS`) serão reutilizadas para FAQs.
- Volume de FAQs é moderado (ordem de milhares), permitindo backfill offline sem impacto operacional.
- Se alguma suposição falhar (ex.: volume muito alto), será necessário particionar/backfill por lotes e ajustar limites/índices.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1 person-day | 1-2 days | 1 person |
| Phase 2 - Implementation | 4 person-days | ~1 week | 1-2 people |
| Phase 3 - Validation | 2 person-days | 2-3 days | 1-2 people |
| **Total** | **7 person-days** | **~2 weeks** | **-** |

### Required Skills
- TypeScript/Node.js (Express) no `server/`
- Drizzle ORM, PostgreSQL e pgvector
- Embeddings e busca semântica
- Observabilidade básica e profiling de latência
- Ajuste de prompts/tools do fluxo OpenRouter

### Resource Availability
- **Available:** Backend Specialist e Database Specialist (sprint atual); Test Writer e Documentation Writer (parcial).
- **Blocked:** Nenhum bloqueio identificado.
- **Escalation:** Architect Specialist para decisões de design ou mudanças de escopo.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Architect Specialist + Backend Specialist: revisar `searchFaqs` atual (`server/storage.ts`) e o padrão híbrido do catálogo para definir o design (assinatura final, tipos, merge, logging e toggle `FAQ_HYBRID_ENABLED`).
2. Database Specialist: desenhar schema `faq_embeddings` (conteúdo, vetor, índice, relação com `faqs`) em `shared/schema.ts` e rascunhar migration SQL.
3. Performance Optimizer: definir baseline de latência/qualidade da busca lexical e um conjunto de queries de QA (paráfrases reais).

**Deliverables**
- Design doc curto (atualização neste plano ou nota em `plans/`).
- PR de schema/migration pronto para revisão.
- Lista de variáveis de ambiente a introduzir (`FAQ_VECTOR_THRESHOLD`, `FAQ_VECTOR_WEIGHT`, `FAQ_LEXICAL_WEIGHT`, `FAQ_HYBRID_ENABLED`, `FAQ_SNIPPET_LIMIT`).

**Evidence Expectations**
- Exemplo documentado de queries onde a busca lexical falha.
- Logs/tempo médio da `searchFaqs` atual.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Database Specialist: implementar `faq_embeddings` em `shared/schema.ts` + migration; aplicar em dev com `npm run db:push`.
2. Backend Specialist / Feature Developer: criar `server/faq-hybrid.ts` (tipos `FaqHybridHit`, `FaqHybridSearchResult`, merge) e adicionar busca vetorial (`searchFaqVector`) usando `generateCatalogEmbedding` (ou refatorar para `generateEmbedding` genérica).
3. Backend Specialist: adicionar `searchFaqsHybrid` (ou tornar `searchFaqs` híbrida mantendo contrato), com fallback lexical se embeddings falharem ou `FAQ_HYBRID_ENABLED=false`.
4. Backend Specialist: atualizar `createFaq` para gerar embedding async para novas FAQs e criar backfill offline (`scripts/seedFaqEmbeddings.ts`) + script de debug (`scripts/debugFaqHybrid.ts`).
5. Backend Specialist: ajustar `/api/chat` (`server/routes.ts`) para usar a busca híbrida e registrar stats análogas ao catálogo.
6. Refactoring Specialist: eliminar duplicação com o catálogo (extraindo utilitários comuns se fizer sentido).

**Deliverables**
- PRs merged: schema/migration, storage+faq-hybrid, scripts, rotas.
- Backfill rodado em staging antes de habilitar produção.

**Evidence Expectations**
- `scripts/debugFaqHybrid.ts` mostrando merge vetorial+lexical.
- Logs de `/api/chat` indicando vetor/lexical/fallback.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Test Writer: adicionar testes determinísticos (ex.: `tests/faq-hybrid.test.ts`) para merge e fallback; ajustar mocks existentes se a assinatura mudar.
2. Performance Optimizer: medir impacto na `/api/chat` e ajustar thresholds/pesos via env.
3. Security Auditor: revisar queries vetoriais e logs por segurança/PII/segredos.
4. Documentation Writer: atualizar `README.md`, `.context/docs/data-flow.md`, `.context/docs/architecture.md`, `.context/docs/glossary.md` e `.context/docs/tooling.md` com novo fluxo e instruções de backfill.
5. Devops Specialist: garantir que migrações/backfill estejam documentados para deploy e que rollback por env seja possível.

**Deliverables**
- Testes verdes e checklist de QA com queries reais.
- Docs atualizadas com diagramas do fluxo híbrido de FAQ.

**Evidence Expectations**
- Relatório de QA (antes/depois) e logs de performance.
- PRs de docs com markers atualizados.

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
- Action: Reverter commits de FAQ híbrida e a migration `faq_embeddings`; manter `searchFaqs` lexical. Alternativamente, desativar via `FAQ_HYBRID_ENABLED=false`.
- Data Impact: Perda apenas dos embeddings; FAQs permanecem intactas.
- Estimated Time: 1-2 hours

#### Phase 3 Rollback
- Action: Rollback de deploy para versão anterior e/ou desativar híbrido por env; reexecutar backfill após correção.
- Data Impact: Nenhum impacto em dados do usuário; embeddings podem precisar ser regenerados.
- Estimated Time: 30-60 minutes

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
- Artifacts: PRs (schema/migration, `faq-hybrid`, integração no chat, scripts, docs), logs do `debugFaqHybrid`, checklist de QA com queries parafraseadas, métricas de latência antes/depois.
- Follow-up: Monitorar hit-rate/latência da busca híbrida por 1 semana (Devops Specialist); recalibrar `FAQ_VECTOR_THRESHOLD`/pesos se necessário (Architect Specialist + Performance Optimizer); programar backfill periódico caso novas FAQs sejam inseridas fora do app (Database Specialist).

<!-- agent-update:end -->
