---
id: plan-catalog-ia-helper
ai_update_goal: "Define the stages, owners, and evidence required to complete Catalog Ia Helper."
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

<!-- agent-update:start:plan-catalog-ia-helper -->
# Catalog Ia Helper Plan

> Criar uma nova feature para ajudar o usuário a completar campos vazios ao adicionar um item no catálogo. Criar um novo botão que chame esta função. A mesma deve verificar os campos vazios e os campos preenchidos.  Devem ser obrigatórios os campos de nome e Fabricante somente. Com essas duas ou mais informações a IA deve fazer o preenchimento dos demais itens.

## Task Snapshot
- **Primary goal:** Entregar um fluxo "Completar com IA" no formulário de novo item do catálogo que, a partir de Nome + Fabricante (mínimo) e campos já preenchidos, sugira valores coerentes para os demais campos.
- **Success signal:** Usuário consegue clicar no botão de ajuda e receber preenchimento automático sem erros de validação; logs/SSE exibem a chamada para a IA; campos obrigatórios seguem exigidos; revisão de código aprovada sem regressões em `npm run check`.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir aderência aos padrões TypeScript/Tailwind e evitar regressões de UX. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Cobrir cenários de falha na chamada da IA (timeouts, respostas vazias). | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar o botão/ação de auto-preenchimento e integrar com backend. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Manter o formulário enxuto e reutilizar hooks existentes ao introduzir a nova ação. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Criar testes de UI (ou mocks) para verificar preenchimento e mensagens de erro. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar README/UX docs com o novo fluxo e dependências da IA. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Monitorar latência extra da chamada da IA e evitar bloqueios na UI. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Garantir que chaves/headers da OpenRouter não vazem em logs ou UI. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Expor endpoint/rota para solicitar preenchimento com contexto parcial. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Ajustar formulário, botão e feedback visual conforme design guidelines. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Confirmar que o fluxo segue limites `server/routes.ts` + `server/storage.ts`. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Validar variáveis de ambiente e pipeline para build/preview com a nova rota. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Checar impacto em `shared/schema.ts` e evitar migrações desnecessárias. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Avaliar esforço se o fluxo for espelhado em clientes móveis futuros. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| OpenRouter indisponível ou resposta incoerente | Medium | High | Implementar fallback (mensagem de erro clara, manter formulário editável) e logs SSE para triagem | Backend Specialist |
| UI bloquear usuário aguardando IA | Medium | Medium | Spinner não bloqueante + botão reativável; limite de tempo; copy clara | Frontend Specialist |
| Cobertura de testes insuficiente | Low | Medium | Adicionar casos de form com campos vazios/preenchidos e mocks da IA | Test Writer |

### Dependencies
- **Internal:** Alinhamento com donos do formulário de catálogo e padrões de UX (design_guidelines.md); infraestrutura de logs SSE.
- **External:** OpenRouter API disponível e com quota; acesso ao Postgres (DATABASE_URL) para validar dados existentes.
- **Technical:** Rotas e tipos compartilhados em `shared/schema.ts`; integração com `server/routes.ts`/`storage.ts`; aliases Vite conforme `vite.config.ts`.

### Assumptions
- Assume o schema atual de catálogo já contém campos opcionais a serem preenchidos pela IA (nenhuma migração necessária).
- Assume que Nome e Fabricante sempre estarão presentes no formulário antes do botão ser clicado.
- Se a IA não devolver sugestões úteis, o usuário continuará podendo editar manualmente e salvar sem o auxílio.
- Se o contrato de OpenRouter mudar, será necessário atualizar o client HTTP e revalidar payloads.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 2 person-days | 3-5 days | 1-2 people |
| Phase 2 - Implementation | 5 person-days | 1-2 weeks | 2-3 people |
| Phase 3 - Validation | 2 person-days | 3-5 days | 1-2 people |
| **Total** | **9 person-days** | **2-3 weeks** | **-** |

### Required Skills
- React + TypeScript para formular UI; Express/Node para rota de IA; conhecimento de OpenRouter; Drizzle/Zod para validar tipos.
- Skill gap: testes automatizados na área do catálogo ainda são raros—precisamos reservar tempo para configurar mocks da IA.

### Resource Availability
- **Available:** 1 Frontend dev (50%), 1 Backend dev (50%), 1 PM/PO para validar UX.
- **Blocked:** QA dedicado indisponível; dependeremos de devs para smoke/manual.
- **Escalation:** Eng lead responsável por catálogo / AI (alinhar via AGENTS.md contato padrão).

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Mapear campos do formulário e regras (owner: Frontend Specialist) usando `glossary.md` e `design_guidelines.md`.
2. Definir contrato do endpoint/ação de IA (owner: Backend Specialist) alinhado com `server/routes.ts` e limites de OpenRouter.
3. Levantar perguntas abertas: copy do botão, limites de tempo, campos que não devem ser alterados.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Implementar rota/função de sugestão com IA (owner: Backend Specialist) seguindo `architecture.md` e `data-flow.md`.
2. Adicionar botão "Completar com IA" no formulário e tratamento de loading/erros (owner: Frontend Specialist) respeitando `design_guidelines.md` e `development-workflow.md` para revisões.
3. Escrever testes (ou mocks) para o fluxo de sugestão e validação de campos obrigatórios (owner: Test Writer).
4. Rodar `npm run check` e validar build `npm run build` antes da revisão.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Executar verificação manual no formulário (campos vazios/preenchidos) e garantir mensagens claras quando a IA falhar.
2. Atualizar docs relevantes (`project-overview.md`, README ou página de UX) e checklist de env vars se necessário.
3. Coletar evidências: logs SSE, prints/GIF do fluxo, saída de `npm run check`.

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
- Action: Reverter commits da rota/botão, remover feature flag se existir, restaurar snapshot de banco se dados inconsistentes forem criados.
- Data Impact: Sem migração esperada; apenas descartar registros inconsistentes do catálogo se inseridos via IA.
- Estimated Time: 2-4 hours

#### Phase 3 Rollback
- Action: Rollback de deployment para release anterior; invalidar cache/CDN se UI estiver em CDN.
- Data Impact: Garantir que itens inseridos via IA sejam revisados ou despublicados manualmente.
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
- Logs SSE e response bodies da IA (anonimizados) para troubleshooting.
- Links de PRs e revisões que cobrem backend e frontend.
- Resultado de `npm run check`/`npm run build` e quaisquer testes adicionados.
- Capturas de tela ou GIF do fluxo "Completar com IA".
- Follow-up: avaliar necessidade de cache/custos da OpenRouter (owner: Performance Optimizer); confirmar se o fluxo deve ser replicado no app móvel (owner: Mobile Specialist).

<!-- agent-update:end -->
