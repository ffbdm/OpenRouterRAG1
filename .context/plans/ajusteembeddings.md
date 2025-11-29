---
id: plan-ajusteembeddings
ai_update_goal: "Define the stages, owners, and evidence required to complete Ajusteembeddings."
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

<!-- agent-update:start:plan-ajusteembeddings -->
# Ajusteembeddings Plan

> Ajustar os seguintes itens: Nao ter limite o tamanho do textPreview dentro de catalog_files. Nao dividir os embeddings dentro de catalog_item_embeddings. E, nao incluir os itens de source do tipo ITEM nessta  tabela, somente os itens do tipo file.

## Task Snapshot
- **Primary goal:** Permitir textPreview completo em `catalog_files`, gravar embeddings sem chunking em `catalog_item_embeddings` e impedir inserção de itens de fonte `ITEM` nessa tabela (apenas `file`).
- **Success signal:** Pipelines de ingestão/exportação rodam sem truncamento, embeddings são um-por-item (sem splits), consultas existentes continuam retornando resultados válidos e a tabela não recebe registros de fontes `ITEM`.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)
  - [Data Flow](../docs/data-flow.md)
  - [Architecture](../docs/architecture.md)
  - [Testing Strategy](../docs/testing-strategy.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir aderência ao estilo e evitar regressões ao alterar schema e pipeline. | [Code Reviewer](../agents/code-reviewer.md) | Revisar mudanças em server/shared e migrações |
| Bug Fixer | Atuar rápido em falhas surgidas com dados legados ou ingestão. | [Bug Fixer](../agents/bug-fixer.md) | Isolar e corrigir erros de processamento de arquivos |
| Feature Developer | Implementar ajustes de schema e lógica de embeddings. | [Feature Developer](../agents/feature-developer.md) | Entregar rotas/pipelines atualizados |
| Refactoring Specialist | Simplificar código após remoção de chunking e limites. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Limpar utilitários e garantias de fluxo |
| Test Writer | Cobrir ingestão de arquivos, geração de embeddings e filtros de fonte. | [Test Writer](../agents/test-writer.md) | Produzir testes unitários/integrados |
| Documentation Writer | Atualizar docs sobre limites de preview e fluxo de embeddings. | [Documentation Writer](../agents/documentation-writer.md) | Registrar novos comportamentos e comandos |
| Performance Optimizer | Avaliar custo de embeddings grandes e cache/indexação. | [Performance Optimizer](../agents/performance-optimizer.md) | Medir tempo/uso de memória em ingestão |
| Security Auditor | Garantir que aumento de payload não expõe dados sensíveis em logs. | [Security Auditor](../agents/security-auditor.md) | Revisar logging e sanitização |
| Backend Specialist | Conduzir alterações em Drizzle/Express e pipelines de ingestão. | [Backend Specialist](../agents/backend-specialist.md) | Ajustar schema, rotas e storage |
| Frontend Specialist | Validar impacto em exibição de previews (caso limites apareçam no UI). | [Frontend Specialist](../agents/frontend-specialist.md) | Checar UI de catálogo para regressões |
| Architect Specialist | Avaliar impacto arquitetural de embeddings longos e estratégia de busca. | [Architect Specialist](../agents/architect-specialist.md) | Confirmar alinhamento com ADRs |
| Devops Specialist | Garantir que builds/deploys aceitem migrações e maior payload. | [Devops Specialist](../agents/devops-specialist.md) | Verificar pipelines e variáveis |
| Database Specialist | Planejar migração, índices e tamanho das colunas/linhas. | [Database Specialist](../agents/database-specialist.md) | Definir estratégia de migração/backfill |
| Mobile Specialist | Sem envolvimento previsto; apenas em standby se app mobile consumir catálogo. | [Mobile Specialist](../agents/mobile-specialist.md) | Sinalizar se APIs quebrarem compatibilidade mobile |

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
| Embeddings muito grandes degradarem ingestão ou buscas | Medium | High | Medir tempo/memória com payload realista, aplicar paginação ou limites de tamanho por configuração | Performance Optimizer |
| Migração afetar dados legados (chunks existentes) | Medium | Medium | Planejar script de backfill/merge, guardar snapshot antes de migrar | Database Specialist |
| Rotas continuarem aceitando fontes `ITEM` por engano | Low | High | Adicionar validação e testes cobrindo filtro de fonte | Backend Specialist |
| Logs vazarem conteúdo extenso de arquivos | Low | Medium | Revisar níveis de log e sanitização após retirar limite de preview | Security Auditor |

### Dependencies
- **Internal:** Coordenação com owners do catálogo para validar impacto de exibir previews completos; acesso ao banco para aplicar migração.
- **External:** Disponibilidade da API OpenRouter/embedding provider para reprocessamento; espaço em storage para arquivos grandes.
- **Technical:** Migração Drizzle para alterar schema de `catalog_files` e `catalog_item_embeddings`; scripts para reprocessar itens já ingeridos.

### Assumptions
- A API de embeddings suporta textos maiores sem erro de payload.
- O cliente (UI) consegue lidar com previews maiores sem truncar ou quebrar layout; se não, ajustar UI ou aplicar truncamento apenas visual.
- Dados existentes podem ser reprocessados ou consolidados sem perda de histórico; se falhar, precisamos de fallback para formato antigo.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1-2 person-days | 2-3 dias corridos | 1-2 people |
| Phase 2 - Implementation | 3-4 person-days | 1 semana | 2-3 people |
| Phase 3 - Validation | 2 person-days | 3-4 dias corridos | 1-2 people |
| **Total** | **6-8 person-days** | **~2 semanas** | **-** |

### Required Skills
- Drizzle/SQL para alterar schema e migrações; experiência com pipelines de embeddings (OpenRouter ou similar).
- Conhecimento de Node/Express para ajustar rotas e storage; testes em Vitest/Jest.
- Skills em observabilidade para medir impacto de payload maior; tuning de índices.
- Gap: se faltar experiência com backfill de dados grandes, agendar pairing com Database Specialist.

### Resource Availability
- **Available:** Backend/Database/Performance specialists com 50% de alocação; Code Reviewer em janelas de revisão diárias.
- **Blocked:** Frontend/Mobile fora até confirmar impacto na UI; DevOps apenas sob demanda para pipeline/migração.
- **Escalation:** Eng. responsável pelo catálogo/PM técnico (alinhamento com architecture/DB leads).

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Levantar pontos de truncamento e chunking no código (catalog ingestion, storage, rotas) — Owner: Backend Specialist.
2. Confirmar limites de payload do provedor de embeddings e tamanho máximo aceitável no DB — Owner: Performance/Database Specialists.
3. Mapear dados legados: como os chunks atuais estão armazenados e consumidos — Owner: Database Specialist.
4. Definir se UI precisa de truncamento apenas visual — Owner: Frontend Specialist (consultivo).
5. Registrar decisões nas docs de arquitetura/data-flow — Owner: Documentation Writer.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Ajustar schema Drizzle: remover limite do `textPreview`, garantir tipos/índices adequados; bloquear inserção de fonte `ITEM` em `catalog_item_embeddings` — Owner: Database/Backend Specialists.
2. Atualizar pipeline de embeddings para usar o texto completo sem dividir em chunks; revisar storage e rotas que assumiam chunking — Owner: Feature Developer.
3. Implementar validações e logs sanitizados para payloads grandes; adicionar feature flag se necessário — Owner: Backend Specialist/Security Auditor.
4. Escrever testes cobrindo ingestão de arquivo, geração de embedding único, bloqueio de fonte `ITEM`, e consultas atuais — Owner: Test Writer.
5. Refatorar utilitários obsoletos (chunk helpers, truncamento) e alinhar com guia de arquitetura — Owner: Refactoring Specialist/Architect.
6. Atualizar docs (data-flow, architecture) e comandos de migração/backfill — Owner: Documentation Writer.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Executar suíte de testes e ensaios manuais de ingestão com arquivos grandes; medir tempo/memória — Owner: Performance/Test Writers.
2. Validar consultas de busca/preview no catálogo (UI e API) para garantir compatibilidade — Owner: Frontend/Backend Specialists.
3. Revisar logs para garantir ausência de dados sensíveis e volume controlado — Owner: Security Auditor.
4. Conduzir backfill/migração de dados legados e validar integridade — Owner: Database Specialist.
5. Registrar evidências, atualizar release notes e handoff para operação — Owner: Documentation Writer/DevOps.

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
- Action: Reverter commits de schema/pipeline, restaurar snapshot do banco pré-migração e descartar backfill parcial.
- Data Impact: Possível perda de embeddings gerados no novo formato; necessidade de reprocessar arquivos.
- Estimated Time: 2-4 hours

#### Phase 3 Rollback
- Action: Rollback de deploy para versão anterior e restauração do snapshot pós-Phase 2.
- Data Impact: Reversão de embeddings únicos para formato antigo; sincronizar para evitar lacunas em buscas.
- Estimated Time: 1-2 hours

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
- Logs e métricas de ingestão com arquivos grandes (tempo/memória/erros).
- Links de PRs/migrations e notas de backfill.
- Saída de testes (unit/integration) e casos manuais validados.
- Atualizações em docs (architecture/data-flow/testing) com comportamentos novos.
- Follow-ups: monitorar tamanho médio da tabela de embeddings e custo de queries; avaliar necessidade de compressão ou indexação adicional; decidir se UI terá truncamento visual configurável.

<!-- agent-update:end -->
