---
id: plan-catalogo-batelada
ai_update_goal: "Define the stages, owners, and evidence required to complete Catalogo Batelada."
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

<!-- agent-update:start:plan-catalogo-batelada -->
# Catalogo Batelada Plan

> Criar uma funcionalidade para incluir itens no catalogo por batelada com um arquivo excel padrao.

## Task Snapshot
- **Primary goal:** Disponibilizar um fluxo ponta a ponta para importar itens do catálogo em lote por meio de um arquivo Excel (.xlsx) padrão, incluindo template, validações servidor/cliente e persistência no Postgres.
- **Success signal:** Usuários conseguem baixar o template, subir um arquivo com ao menos 100 itens válidos, visualizar pré-validações, concluir o upload sem erros e ver os itens recém-criados retornando em `/api/catalog` e na UI, com logs, testes e documentação atualizados.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que a nova API e UI sigam padrões de estilo, segurança e logging antes do merge. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Responder rapidamente a falhas encontradas no upload (ex.: parsing de Excel ou erros de validação) durante QA. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Conduzir implementação do endpoint, parsing Excel e interface de upload guiada. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Modularizar código compartilhado (ex.: validadores de planilha e normalização de tags) para evitar duplicidades futuras. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Cobrir parsing, validação por linha e respostas do endpoint com testes unitários/integrados. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar README/AGENTS com o template .xlsx, guia de uso e limites conhecidos. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Avaliar impacto do processamento de planilhas grandes (streaming vs buffer) e sugerir limites saudáveis. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisar upload para evitar execução arbitrária e validar controles de autenticação/token de blob. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Definir contrato do endpoint, integração com Drizzle e Drizzle transactions para lotes grandes. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Criar UI de seleção de arquivo, preview de erros e feedback para o usuário final. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Assegurar que o fluxo em lote não conflite com ingestões futuras (CSV/API) e alinhar com arquitetura existente. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Preparar pipelines para lidar com novos pacotes (ex.: `xlsx`) e garantir que builds/gates executem testes adicionados. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Revisar impacto de inserções maciças, índices e possíveis migrations para colunas auxiliares (ex.: hash de linhas). | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Avaliar se fluxo precisa ter paridade mínima em apps móveis; garantir mensagens API adequadas para consumo mobile. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| Falta de acesso ao storage de blobs/configuração de tokens | Medium | High | Solicitar credenciais antes da implementação e criar fallback local (mock) documentado. | Backend Specialist |
| Cobertura de testes insuficiente para validações de planilha | Low | Medium | Travar critério de aceite exigindo cenários felizes e falhos em `tests/catalog-*`. | Test Writer |
| Processamento de planilhas muito grandes derruba servidor | Medium | High | Limitar tamanho de arquivo, processar em lotes e adicionar monitoramento de tempo. | Performance Optimizer |

### Dependencies
- **Internal:** Storage layer (`server/storage.ts`), serviço de blobs configurado em `catalog-file-storage.ts`, e alinhamento com time que mantém o `client/src/pages/catalog.tsx` para integrar UI.
- **External:** Biblioteca de parsing Excel (`xlsx` ou `exceljs`), serviço de autenticação atual para garantir que apenas usuários autorizados consigam importar.
- **Technical:** Atualização do schema Drizzle caso sejam necessários campos extras (ex.: `batch_id`), scripts `npm run db:push`, e inclusão de dependências no `package.json` com suporte em bundlers (Vite/esbuild).

### Assumptions
- Fluxo de autenticação/autorizações atual continuará estável; caso mude, endpoint precisará ser adaptado para novos tokens/claims.
- Usuários aceitam trabalhar com template fornecido (.xlsx); se precisarem de CSV/Google Sheets, será necessário novo conversor e atualização desta planilha.
- Base de dados consegue suportar inserções em lote (até ~500 itens por upload); se não suportar, teremos de criar queue/jobs assíncronos antes da GA.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 2 person-days | 3-4 days | 2 people |
| Phase 2 - Implementation | 7 person-days | 1-2 weeks | 3 people |
| Phase 3 - Validation | 3 person-days | 3-5 days | 2 people |
| **Total** | **12 person-days** | **~3 weeks corridas** | **-** |

### Required Skills
- Experiência com React + Vite e controle de estado para UI de upload.
- Conhecimento em Node/Express, Drizzle e Postgres para transações em lote.
- Familiaridade com bibliotecas de parsing Excel (`xlsx`, `sheetjs`).
- Observabilidade (logs estruturados e métricas básicas) para acompanhar execuções longas.
- **Skill gaps:** ninguém no time trabalhou com validação de Excel antes; reservar meio dia para POC e leitura do guia da biblioteca escolhida.

### Resource Availability
- **Available:**
  - Fab (backend) — 60% do tempo nas próximas 3 semanas.
  - Ana (frontend) — 50% do tempo para UI e DX.
  - Leo (QA/Test Writer) — 30% dedicado a testes exploratórios e automação.
- **Blocked:** DevOps principal em outro projeto até metade da fase 2; combinar handoff para revisão de pipeline.
- **Escalation:** Contatar Marina (Eng Lead) caso estimativas estourem ou dependências externas travem.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Mapeamento de requisitos (owner: Product + Backend Specialist) — confirmar colunas obrigatórias, limites de lote e mensagens de erro desejadas.
2. Alinhar formato do template e contrato da API com Frontend Specialist, registrando exemplo em `docs/glossary.md`.
3. Levantar perguntas abertas: suporte a atualização vs criação, política de duplicados, limites de tamanho e compatibilidade com futuras integrações.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Implementar endpoint `/api/catalog/import` com parsing incremental e validações linhas/colunas (pairing Backend + Database Specialist).
2. Criar UI (botão Baixar Template, input de arquivo, resumo de sucesso/erros) e integrar com `react-query` (Frontend Specialist + Feature Developer).
3. Escrever testes unitários (validação de planilha) e integração (rota Express) seguindo playbook do [Test Writer](../agents/test-writer.md).
4. Revisões em dia sim/dia não com Code Reviewer e Security Auditor focando em logging, limites e autenticação.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Executar suite automatizada (`npm run check`, testes novos) e rodar cenário real importando template com dados fictícios.
2. Atualizar README, `docs/data-flow.md` e AGENTS com instruções de uso e troubleshooting.
3. Coletar métricas de performance (tempo para 10, 100 e 500 itens) e anexar aos resultados.
4. Preparar handoff para suporte com resumo de logs esperados e plano de rollback.

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
- Action: Reverter commits relacionados (git revert), restaurar banco a snapshot anterior via `pg_dump`/`pg_restore`, remover dependências recém-adicionadas.
- Data Impact: Possível remoção de itens importados durante o período; comunicar usuários e reexecutar importação com planilha original.
- Estimated Time: 2-4 horas

#### Phase 3 Rollback
- Action: Executar rollback da release no ambiente (redeploy versão anterior), invalidar caches CDN e desabilitar botão de upload via feature flag.
- Data Impact: Garantir sincronização entre banco e arquivos de blob — remover uploads parcialmente processados para evitar órfãos.
- Estimated Time: 1-2 horas

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
- Logs de execução (tempo por lote) e prints das telas.
- Links de PR com revisões aprovadas, checklist de segurança e execuções verdes do pipeline.
- Resultado de testes automatizados e planilha de validação manual anexada ao ticket.
- Follow-up: revisar após 1 sprint métricas de uso/erros (owner: Product) e avaliar necessidade de suportar formatos adicionais (owner: Architect Specialist).

<!-- agent-update:end -->
