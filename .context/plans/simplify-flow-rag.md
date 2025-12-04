---
id: plan-simplify-flow-rag
ai_update_goal: "Define the stages, owners, and evidence required to complete Simplify Flow Rag."
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

<!-- agent-update:start:plan-simplify-flow-rag -->
# Simplify Flow Rag Plan

> Iremos simplificar o fluxo do rag. Iremos retirar o generic produtc list. Iremos retirar o detectAgronomyIntent. Retirar o detectFOrcedTool. Quero que ocorra o seguinte: Apos a primeira interaçao do ususaio seja enviada a primeira interacao com a IA. E depois,   vamos seguir o fuxo como esta hoje.

## Task Snapshot
- **Primary goal:** Simplificar o fluxo do `/api/chat` removendo heurísticas (generic product list, `detectAgronomyIntent`, `detectForcedTool`) para que toda primeira interação do usuário seja enviada ao LLM e o restante siga o pipeline 2-hop atual.
- **Success signal:** Toda pergunta do usuário dispara a primeira chamada ao LLM sem bloqueios; as heurísticas de pré-filtro/remendo deixam de aparecer nos logs/JSON; chamadas de tools continuam automáticas pelo modelo; smoke tests mostram respostas com dados de catálogo/FAQ quando disponíveis.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Validar que a remoção de heurísticas mantém padrões e logs do fluxo 2-passos. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Monitorar regressões de tools/500s após simplificação do roteamento. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar o fluxo simplificado e ajustar prompts/tooling. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Garantir que helpers removidos não deixem código morto ou ramos redundantes. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Definir smoke tests manuais/automatizados para o novo caminho sem heurísticas. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar data-flow/overview com o novo comportamento de primeira chamada. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Observar impacto de mais chamadas ao LLM em latência/custo. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisar logs para garantir que dados sensíveis não vazem após ajustes. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Liderar alterações em `server/routes.ts` e storage para manter RAG estável. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Confirmar que o cliente continua exibindo debug/logs corretos sem prompts extras. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Checar se o fluxo simplificado ainda honra a arquitetura 2-stage (gather/respond). | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Validar que os novos logs funcionam em build e monitoramentos. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Garantir que consultas híbridas continuam eficientes mesmo sem pré-filtros. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Sem ação principal; apenas verificar que futuras UIs móveis usariam o fluxo simplificado. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| Remoção de `detectAgronomyIntent` reduzir recall de catálogo em perguntas genéricas | Medium | Medium | Reforçar instruções `chatGather` para incentivar searchCatalog e revisar logs pós-merge | Backend Specialist |
| Sem `detectForcedTool`, LLM pode não chamar tools e responder sem dados | Medium | High | Ajustar prompts system, validar com smoke tests (FAQ + catálogo) e monitorar `llmCalls`/debug | Feature Developer |

### Dependencies
- **Internal:** storage/searchCatalogHybrid e searchFaqs prontos e com dados mínimos; instruções em `system_instructions` atualizadas.
- **External:** OpenRouter disponível e com latência estável para duas chamadas por interação.
- **Technical:** `OPENROUTER_API_KEY` e `DATABASE_URL` carregadas em `.env`; logs SSE funcionando para validar o fluxo.

### Assumptions
- LLM consegue decidir chamada de tool apenas com instruções (sem heurísticas); se falhar, reintroduzir pequeno nudge no prompt em vez de lógica de código.
- Remover a checagem de pergunta genérica não aumenta custo significativamente porque o LLM já filtra intenção; se tokens explodirem, reavaliar limites de mensagem.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 0.5 person-day | 0.5-1 dia | 1-2 people |
| Phase 2 - Implementation | 1.5 person-days | 2-3 dias | 1-2 people |
| Phase 3 - Validation | 0.5 person-day | 0.5-1 dia | 1 person |
| **Total** | **2.5 person-days** | **3-5 dias** | **-** |

### Required Skills
- Express/TypeScript, fluxo OpenRouter com tools, Drizzle storage, leitura de logs SSE.
- Sem gaps mapeados; se o modelo não respeitar tools, revisar playbook de prompt engineering.

### Resource Availability
- **Available:** Backend/Feature dev (Codex) com 2-3 dias livres; reviewer assíncrono.
- **Blocked:** Nenhum bloqueio atual; UX pode entrar depois se precisar alterar UI.
- **Escalation:** Fabio Fernandes para priorização/decisões de recuo.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Mapear o fluxo atual em `server/routes.ts` (genérico de produtos, detectAgronomyIntent, detectForcedTool) e confirmar com `data-flow.md` onde serão removidos — Owner: Backend Specialist.
2. Listar perguntas em aberto (ex.: manter limite default de catalog/FAQ? ajustar instruções `chatGather`/`chatRespond`?) e registrar em `plans/README.md` — Owner: Feature Developer.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Remover heurísticas (`requiresProductClarification`, `detectAgronomyIntent`, `detectForcedTool`) e garantir que a primeira mensagem segue direto para o LLM com tools auto — Owner: Backend Specialist.
2. Ajustar instruções/prompt e logs de debug para incentivar chamadas de tool sem forçar, validar com execuções locais (`npm run dev`) e revisar via Code Reviewer — Owner: Feature Developer.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Executar smoke tests manuais (pergunta de catálogo genérica, FAQ específica, pergunta sem dados) e confirmar `llmCalls`/debug no payload — Owner: Test Writer.
2. Atualizar `data-flow.md`/`architecture.md` se a sequência mudar e anexar evidências (logs, prints) antes do handoff — Owner: Documentation Writer.

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
- Action: Reverter commits que removeram heurísticas, restaurar helpers (`detectAgronomyIntent`, `requiresProductClarification`, `detectForcedTool`) e reimplantar versão anterior.
- Data Impact: Nenhum (somente lógica de roteamento e logs, sem migrações).
- Estimated Time: 1-2 horas

#### Phase 3 Rollback
- Action: Rollback do deploy para build anterior (`dist/` ou release prévia) e limpar cache de frontend se necessário.
- Data Impact: Nenhum; sem alterações de schema ou dados persistidos.
- Estimated Time: 1 hora

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
- Artifacts: diff/PR link com remoções em `server/routes.ts`, logs SSE das três queries de smoke test, captura do debug JSON mostrando `llmCalls`, nota de atualização em `data-flow.md`.
- Follow-up: Monitorar erros 500 e quedas de recall nas primeiras 48h pós-deploy (Owner: Bug Fixer); reavaliar prompt se `searchCatalog` não for acionado em perguntas de produto (Owner: Feature Developer).

<!-- agent-update:end -->
