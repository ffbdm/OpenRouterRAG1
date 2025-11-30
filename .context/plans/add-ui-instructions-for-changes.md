---
id: plan-add-ui-instructions-for-changes
ai_update_goal: "Define the stages, owners, and evidence required to complete Add Ui Instructions For Changes."
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

<!-- agent-update:start:plan-add-ui-instructions-for-changes -->
# Add Ui Instructions For Changes Plan

> Adicionar na UI todas as instrucoes existentes no sistema, afim que de o usuario possa modificar e salvar sempre que quiser.

## Task Snapshot
- **Primary goal:** Exibir todas as instruções do sistema dentro da UI (catálogo e chat), permitindo que usuários autorizados visualizem, editem e persistam alterações usando as APIs existentes em `server/`.
- **Success signal:** Usuários conseguem abrir a tela dedicada, atualizar instruções e ver o conteúdo refletido após recarregar; logs registram a alteração e `npm run check` passa sem regressões em `client/` e `server/`.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garante aderência aos padrões descritos em `../docs/development-workflow.md` e em `AGENTS.md`, evitando regressões visuais. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Mantém prontidão para investigar erros decorrentes de instruções mal formatadas e atualiza playbooks de mitigação. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Lidera a construção do painel de instruções e integrações com o backend Express. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Garante reaproveitamento das abstrações em `client/src/components/ui` e organização das rotas em `server/routes.ts`. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Define cenários automatizados seguindo `../docs/testing-strategy.md` para edição e persistência. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualiza `README.md` e `../docs/project-overview.md` com instruções de uso e screenshots. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Mede impacto no carregamento do catálogo e recomenda caching/streaming em `client/src/lib/queryClient.ts`. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisa validações em `server/openrouter.ts` e `../docs/security.md` para evitar exposição de segredos nas instruções. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Coordena ajustes em `shared/schema.ts`, `server/catalog-routes.ts` e migrações necessárias. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Define UX consistente com `client/src/components/AppLayout.tsx` e `LogTerminal`. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Checa aderência às decisões descritas em `../docs/architecture.md` e valida limites entre camadas. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Ajusta pipelines/CI descritas em `../docs/development-workflow.md` se novas variáveis ou assets surgirem. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Avalia impactos no Postgres/Drizzle e acompanha `npm run db:push`. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Valida se a API de instruções permanece consumível por futuros clientes móveis/SDKs. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| Aprovação de UX/copy depende do time de Design | Medium | High | Bloquear reviews semanais e alinhar com guias em `design_guidelines.md` | Frontend Specialist |
| Cobertura insuficiente nos testes das novas rotas | Low | Medium | Planejar testes de API/UI logo após definir contratos e seguir `../docs/testing-strategy.md` | Test Writer |
| Latência extra ao carregar instruções com o catálogo | Low | Medium | Implementar cache React Query e fallback otimista descrito no playbook do Performance Optimizer | Performance Optimizer |

### Dependencies
- **Internal:** Time de Design para aprovar layout/copy, equipe de plataforma para habilitar logs no `server/log-stream.ts` e squad de dados para revisar `shared/schema.ts`.
- **External:** Disponibilidade das APIs OpenRouter e acesso contínuo ao banco Postgres (Neon) conforme credenciais em `.env`.
- **Technical:** Execução de `npm run db:push` após ajustes de schema, verificação do bundle via `npm run build` e garantia de que `client/src/lib/queryClient.ts` comporta o novo cache.

### Assumptions
- Assume que o schema atual já persiste todas as instruções necessárias; se descobrir campos faltando, planejar nova migração Drizzle e reavaliar o esforço.
- Assume que permissões atuais bastam para editar instruções; se não, Security Auditor define RBAC adicional e adiciona backlog específico.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 2 person-days | 3-4 days | 2 people |
| Phase 2 - Implementation | 5 person-days | 1 week | 3 people |
| Phase 3 - Validation | 2 person-days | 3 days | 2 people |
| **Total** | **9 person-days** | **~2.5 weeks incluindo buffers** | **-** |

### Required Skills
- Experiência com React, Tailwind e React Query para construir a UI e orquestrar cache; domínio de Express/Drizzle para expor e persistir instruções.
- Treinamento rápido sobre o design system local (`client/src/components/ui`) e revisão de políticas de segurança descritas em `../docs/security.md` para membros novos.

### Resource Availability
- **Available:** Frontend Specialist (50%), Backend Specialist (40%), Documentation Writer (ad-hoc), Test Writer (30%).
- **Blocked:** DevOps Specialist focado em ajustes de CI/CD nesta sprint; alinhar janelas de deploy antes da Fase 3.
- **Escalation:** Architect Specialist atua como ponto de contato para priorização e apoio com stakeholders.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Inventariar instruções existentes em `shared/schema.ts` e `server/catalog-hybrid.ts`, validando se o schema atende aos requisitos — Owner: Backend Specialist.
2. Mapear requisitos de UX/copy com Design e registrar perguntas abertas (escopo, permissões) em `plans/README.md` — Owner: Frontend Specialist.

**Discovery Notes (30/11/2025)**
- Não existe tabela ou API de instruções no schema atual; criaremos `system_instructions` (slug único, scope enum `global|chat|catalog`, título descritivo, conteúdo em texto longo, timestamps) e popular com valores default (prompt do chat e briefing do catálogo) durante a migração.
- O backend exporá `GET /api/instructions` (filtro opcional por `scope`) e `PUT /api/instructions/:slug`, além de consumir `chat-system` direto do banco no fluxo do `/api/chat`.
- A UI terá um `InstructionSheet` reutilizável com botão em Chat e Catálogo, exibindo instruções de `global` + escopo atual, edição inline com React Query + toasts e preview somente leitura para quem não editar.
- Precisamos registrar decisão de permissões (por enquanto todos os usuários da SPA) no README até que RBAC esteja disponível.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Implementar listagem/edição na SPA usando componentes de `client/src/components/ui`, além de expor rotas Express e logs; prever pairings diários entre Feature Developer e Backend Specialist.
2. Conferir `../docs/architecture.md` e seguir o playbook do Feature Developer para dividir PRs (UI, API, persistência) mantendo revisões assíncronas a cada entrega.

**Implementation Notes (30/11/2025)**
- Criadas as rotas `GET /api/instructions`, `GET /api/instructions/:slug` e `PUT /api/instructions/:slug`, todas apoiadas pelo novo módulo `server/instruction-routes.ts` e helpers de escopo.
- O prompt do chat (`chat-system`) deixou de ser hardcoded e passou a ser carregado do banco (com fallback logado se estiver ausente).
- Novos componentes reutilizáveis (`InstructionsPanel`) foram encaixados no Chat e no Catálogo, reaproveitando `Accordion`, toasts e React Query para persistir edição inline.
- Adicionada a migração `0002_system_instructions.sql` com seeds (`chat-system`, `catalog-guidelines`, `global-operating-principles`) e documentação atualizada em README + `project-overview.md` para orientar `npm run db:push`.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Executar `npm run check`, validar logs em `server/log-stream.ts`, cobrir casos críticos com testes (unitários e e2e manuais) conforme `../docs/testing-strategy.md`, e atualizar README + docs com screenshots — Owners: Test Writer & Documentation Writer.
2. Registrar evidências (links de PR, resultados de testes, aprovações de UX) e anexar ao handoff compartilhado com Code Reviewer e stakeholders.

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
- Action: Reverter commits relacionados à UI/API, desfazer migrações via `npm run db:push -- --force --to <last-good>` e restaurar snapshot do banco mantido pela equipe de dados.
- Data Impact: Possível perda de instruções alteradas durante o intervalo; comunicar usuários e restaurar registros a partir dos logs se necessário.
- Estimated Time: 2-3 horas incluindo verificação de integridade.

#### Phase 3 Rollback
- Action: Executar rollback do deploy seguindo `../docs/development-workflow.md`, voltar a versão anterior do bundle e desativar temporariamente a edição de instruções.
- Data Impact: Garantir sincronização entre cache de instruções e banco restaurando backup incremental; avisar usuários sobre potencial perda de mudanças recentes.
- Estimated Time: 1-2 horas após gatilho.

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
- PRs por fase, execução de `npm run check`, capturas da UI anexadas em `attached_assets/`, logs de `server/log-stream.ts` e checklist de QA conforme `../docs/testing-strategy.md`.
- Follow-up: Frontend Specialist coleta feedback dos usuários após 1 semana, Documentation Writer agenda revisão trimestral do guia para manter instruções atualizadas.

<!-- agent-update:end -->
