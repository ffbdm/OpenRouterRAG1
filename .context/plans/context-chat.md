---
id: plan-context-chat
ai_update_goal: "Define the stages, owners, and evidence required to complete Context Chat."
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

<!-- agent-update:start:plan-context-chat -->
# Context Chat Plan

> Criar um contexto para llm com as última 6 conversas (valorcriar uma nova variavel de ambiente) e entregar  no contextSections  dentro de routes.ts.

## Task Snapshot
- **Primary goal:** Mapear e entregar um plano para incluir as últimas 6 conversas (configurável via nova env var) no `contextSections` do `/api/chat` em `server/routes.ts`.
- **Success signal:** Env var documentada com default seguro, ponto de inserção do histórico definido, evidências de QA mostrando 6 interações chegando ao modelo sem estourar limite de tokens ou quebrar o fluxo atual.
- **Key references:**
  - [Documentation Index](../docs/README.md) (ver Data Flow e Architecture para `/api/chat`)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que a inclusão do histórico e da env var siga padrões de log, estilo e contratos do `routes.ts`. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Antecipar falhas (env var ausente, histórico vazio, overflow de tokens) e mapear como monitorar/mitigar. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar leitura do histórico, aplicação do limite via env var e montagem no `contextSections`. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Manter a montagem do contexto modular para não acoplar `routes.ts` a detalhes do cliente. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Definir smoke tests manuais/automatizados para confirmar que 6 interações aparecem no contexto e logs. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar README/env docs com a nova variável e como ajustar o limite de histórico. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Avaliar o impacto de tokens do histórico e definir truncamentos/limites máximos. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Validar que o histórico não vaza dados sensíveis além do necessário e segue sanitização existente. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Escolher a fonte do histórico (payload do cliente ou cache) e encaixar na orquestração do `/api/chat`. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Confirmar contrato do cliente: qual porção do histórico será enviada e como serializar. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Garantir que o contexto adicional não quebre o fluxo de duas chamadas ao OpenRouter nem o SSE. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Planejar a propagação da nova env var em dev/prod e validar defaults seguros. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Checar se não há necessidade de persistir histórico; confirmar que consultas atuais permanecem leves. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Monitorar impacto zero no consumo móvel; apenas validar contrato da API se apps móveis existirem. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| Fonte do histórico indefinida (cliente vs backend) gerando contexto incorreto | Medium | High | Revisar Data Flow e contrato do chat antes de codar; alinhar payload esperado e fallback quando vazio | Backend Specialist |
| Tokens estourando ao anexar 6 mensagens longas | Medium | Medium | Definir env var com limite máximo, truncar/sumarizar mensagens e logar tamanho do contexto | Performance Optimizer |
| Nova env var ausente em deploy ou com valor inválido | Low | Medium | Default seguro em código, validação na inicialização e checklist de DevOps/README para configuração | Devops Specialist |

### Dependencies
- **Internal:** Contrato do payload de chat no cliente, disponibilidade do SSE/log terminal para validação, fluxo atual de `contextSections` em `server/routes.ts`.
- **External:** Limites de tokens e latência do OpenRouter; configuração de ambiente nos targets de deploy.
- **Technical:** Possível necessidade de truncar/sanitizar histórico antes de enviar ao LLM; garantir que o build/server leem a nova env var.

### Assumptions
- Histórico das conversas recentes estará disponível no cliente e pode ser enviado no payload sem criar nova persistência.
- As 6 últimas interações cabem no budget do modelo atual; se não couberem, a env var permitirá reduzir o limite sem alterar código.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 0.5 person-day | 1 day | 1 person |
| Phase 2 - Implementation | 1.5 person-days | 2-3 days | 1-2 people |
| Phase 3 - Validation | 0.5 person-day | 1 day | 1 person |
| **Total** | **2.5 person-days** | **4-5 days** | **-** |

### Required Skills
- Express/TypeScript, OpenRouter prompt/context design, manuseio de env vars em Node/Vercel, QA manual com SSE/logs.
- Gap potencial: necessidade de técnica de truncamento/sumarização de histórico caso o modelo queime tokens rápido.

### Resource Availability
- **Available:** 1 dev backend com contexto do `routes.ts`, 1 dev frontend para alinhar payload e testes.
- **Blocked:** Nenhum bloqueio declarado; depende apenas de confirmação do contrato do cliente.
- **Escalation:** Tech lead/maintainer do projeto para destravar decisões de contrato ou limite padrão.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Mapear onde `contextSections` é montado no `/api/chat` e confirmar fonte do histórico com o cliente (owner: Backend Specialist).
2. Definir nome/default/max da env var (ex.: `CHAT_HISTORY_CONTEXT_LIMIT` com default 6) e capturar perguntas abertas sobre truncamento e ordem das mensagens (owner: Devops Specialist + Feature Developer).

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Implementar leitura/aplicação do histórico limitado pela env var e anexar ao `contextSections`, garantindo sanitização e logs de debug (owner: Feature Developer).
2. Atualizar docs/env examples e, se necessário, ajustar contrato do cliente para enviar o histórico; alinhar revisão com Code Reviewer (owner: Documentation Writer + Frontend Specialist).

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Executar teste manual/automação leve (chamadas sequenciais ao `/api/chat`) confirmando que as últimas 6 mensagens entram no contexto e aparecem nos logs (owner: Test Writer).
2. Registrar evidências, atualizar README/AGENTS com a env var final e documentar como ajustar o limite em produção (owner: Documentation Writer).

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
- Action: Reverter commits de `routes.ts` e docs/env var, removendo o uso do histórico extra.
- Data Impact: Nenhum (somente lógica e configuração; sem alterações de banco).
- Estimated Time: ~1 hora

#### Phase 3 Rollback
- Action: Reverter deploy para a versão anterior ou desabilitar a env var no runtime, confirmando via logs que o contexto voltou ao estado antigo.
- Data Impact: Nenhum; apenas cessa o envio de histórico adicional.
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
- Logs/SSE capturas mostrando o `contextSections` com histórico limitado.
- PR/diff com ajustes em `server/routes.ts`, .env docs e contratos cliente-servidor.
- Passo-a-passo de teste manual (payloads usados) para reproduzir validação.
- Follow-ups: alinhar com frontend se o payload de histórico mudar e registrar no próximo changelog/README.

<!-- agent-update:end -->
