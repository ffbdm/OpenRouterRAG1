---
id: plan-one-shoot-with-zero-tool-calls
ai_update_goal: "Define the stages, owners, and evidence required to complete One Shoot With Zero Tool Calls."
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

<!-- agent-update:start:plan-one-shoot-with-zero-tool-calls -->
# One Shoot With Zero Tool Calls Plan

> Eliminar a segunda chamada ao OpenRouter quando nenhuma fonte estruturada (FAQs ou catálogo híbrido) for consultada, reduzindo latência do `/api/chat` sem quebrar o fluxo descrito em `architecture.md` e `data-flow.md`.

## Task Snapshot
- **Primary goal:** Permitir que o servidor responda com a primeira saída do modelo quando não houver consultas ao banco, mantendo logs e contratos atuais do endpoint.
- **Success signal:** Requisições sem `databaseQueried` retornam apenas uma chamada LLM (~45% menos tempo médio) e o log terminal evidencia `⚠️ Banco NÃO foi consultado` sem nova ida ao OpenRouter.
- **Key references:**
  - [Documentation Index](../docs/README.md) — garante alinhamento com demais guias.
  - [Architecture Notes](../docs/architecture.md) — confirma que hoje sempre ocorrem duas chamadas sequenciais.
  - [Data Flow & Integrations](../docs/data-flow.md) — descreve quando as ferramentas são acionadas.
  - [Agent Handbook](../agents/README.md) — seleção de especialistas.
  - [Plans Index](./README.md) — rastreia atualização deste plano.

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que a lógica condicional nova preserve contratos do endpoint e padrões descritos em `development-workflow.md`. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Monitorar regressões (e.g., respostas vazias ou logs incorretos) após mudar o fluxo. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar o curto-circuito no fluxo e atualizar debug payloads. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Simplificar blocos condicionais em `server/routes.ts` para evitar duplicação de fetch. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Criar/atualizar testes unitários em `tests/catalog-hybrid.test.ts` ou adicionar novos focused em `/api/chat`. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Registrar a nova decisão operacional nos planos e possivelmente em `docs/data-flow.md`. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Medir o ganho de latência com e sem consulta para provar ROI. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Confirmar que o early-return não expõe payloads parciais ou tokens nos logs. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Validar integração com `storage` e SSE para garantir consistência de métricas. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Ajustar UI caso novos campos no `debug` sejam exibidos. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Assegurar que a mudança não contrarie a decisão registrada em `architecture.md`. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Verificar métricas de produção e alarmes após o deploy. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Revisar se `searchFaqs`/`searchCatalog` continuam opcionais no fluxo. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Sem ação direta; manter apps clientes cientes da mudança no tempo de resposta. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

## Documentation Touchpoints
| Guide | File | Task Marker | Primary Inputs |
| --- | --- | --- | --- |
| Project Overview | [project-overview.md](../docs/project-overview.md) | agent-update:project-overview | Confirma escopo "chat + catálogo" descrito na visão geral |
| Architecture Notes | [architecture.md](../docs/architecture.md) | agent-update:architecture-notes | Define o ciclo de duas chamadas que será otimizado |
| Development Workflow | [development-workflow.md](../docs/development-workflow.md) | agent-update:development-workflow | Garante PRs pequenos e revisões rápidas para deploy |
| Testing Strategy | [testing-strategy.md](../docs/testing-strategy.md) | agent-update:testing-strategy | Estabelece meta de cobrir rota `/api/chat` com testes determinísticos |
| Glossary & Domain Concepts | [glossary.md](../docs/glossary.md) | agent-update:glossary | Termos como RAG, catálogo híbrido, FAQ |
| Data Flow & Integrations | [data-flow.md](../docs/data-flow.md) | agent-update:data-flow | Documenta como ferramentas são chamadas e quando ocorre a segunda ida ao LLM |
| Security & Compliance Notes | [security.md](../docs/security.md) | agent-update:security | Reforça política de não expor tokens durante logs adicionais |
| Tooling & Productivity Guide | [tooling.md](../docs/tooling.md) | agent-update:tooling | Scripts e comandos (`npm run dev`, `npm run check`) necessários para validação |

## Risk Assessment
Identify potential blockers, dependencies, and mitigation strategies before beginning work.

### Identified Risks
| Risk | Probability | Impact | Mitigation Strategy | Owner |
| --- | --- | --- | --- | --- |
| Resposta vazia caso a primeira chamada retorne apenas instruções | Low | High | Adicionar checagem de fallback (mensagem padrão) antes do early-return | Feature Developer |
| Métricas de observabilidade perdem indicação da segunda chamada | Medium | Medium | Atualizar logs e debug payloads com campo `llmCalls` | Performance Optimizer |
| QA não percebe mudança e cria regressão ao forçar catálogo manualmente | Low | Medium | Documentar comportamento na página de FAQ do time e revisão cruzada | Documentation Writer |

### Dependencies
- **Internal:** Coordenação com equipe de frontend para refletir novo campo de debug (se necessário) e alinhamento com DevOps sobre métricas.
- **External:** OpenRouter precisa continuar retornando conteúdo completo na primeira chamada (`choices[0].message.content`).
- **Technical:** Logs/SSE dependem do `log-stream.ts`; qualquer ajuste deve manter compatibilidade.

### Assumptions
- A primeira chamada sempre retorna texto útil quando não há tools; se essa hipótese falhar, devemos reintroduzir a segunda chamada como fallback.
- O contrato da UI aceita respostas sem campo `hybrid`; caso contrário, será necessário default explícito (`undefined`).

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 0.5 person-day | 1 day | 1-2 people |
| Phase 2 - Implementation | 1.5 person-days | 2-3 dias | 2 pessoas |
| Phase 3 - Validation | 1 person-day | 1-2 dias | 1-2 pessoas |
| **Total** | **3 person-days** | **~1 semana corrido** | **-** |

### Required Skills
- Express/TypeScript avançado, domínio do fluxo descrito em `server/routes.ts`.
- Conhecimento de OpenRouter e function calling.
- Observabilidade com SSE/log-stream.
- Nenhum gap previsto; pair programming entre Backend Specialist e Feature Developer cobre conhecimento crítico.

### Resource Availability
- **Available:** Backend Specialist + Feature Developer (janela de 1 semana já aprovada).
- **Blocked:** Nenhum bloqueio identificado.
- **Escalation:** Tech Lead responsável pelo RAG (consultar `AGENTS.md`).

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Backend Specialist analisa `server/routes.ts`, `architecture.md` e `data-flow.md` para mapear pontos onde a segunda chamada é iniciada mesmo sem tool (0.25d).
2. Architect Specialist valida critérios de saída (quando retornar apenas com a primeira resposta) e registra perguntas abertas (0.25d).

**Commit Checkpoint**
- `chore(plan): complete phase 1 discovery` com resumo de decisões + atualização deste plano.

### Phase 2 — Implementation & Iteration
**Steps**
1. Feature Developer implementa curto-circuito: captura resposta inicial, adiciona metadados `llmCalls`, e garante que logs/SSE reflitam o novo caminho (1d).
2. Refactoring Specialist revisa condicionais, extrai helper se necessário, e garante aderência ao `development-workflow.md` quanto a padrões de PR (0.5d).
3. Code Reviewer conduz revisão assíncrona; Bug Fixer cobre cenários negativos durante QA manual.

**Commit Checkpoint**
- `feat(rag): skip final llm when db idle` (ou similar) contendo código + notas de migração inexistentes.

### Phase 3 — Validation & Handoff
**Steps**
1. Test Writer cria teste automatizado (ou script manual documentado) provando que consultas sem tool usam apenas 1 chamada e mantêm mensagem final (0.5d).
2. Performance Optimizer mede latência antes/depois (logs SSE + cronômetro local) e adiciona resultados no PR/README (0.25d).
3. Documentation Writer atualiza `data-flow.md` e `architecture.md` se necessário, anexando evidências.

**Commit Checkpoint**
- `chore(docs): record zero-tool path` registrando métricas e atualizações documentais.

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
- Action: Reverter PR que introduziu o curto-circuito e restaurar versão anterior de `server/routes.ts`.
- Data Impact: Nenhum (mudança apenas em fluxo de chamadas externas).
- Estimated Time: 1-2 horas.

#### Phase 3 Rollback
- Action: Executar rollback do deploy (Vercel) para build anterior e limpar feature flag/caches relacionados.
- Data Impact: Nenhum; apenas latência volta ao estado anterior.
- Estimated Time: 1 hora.

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
- Logs SSE demonstrando `llmCalls: 1` e ausência da segunda chamada quando `databaseQueried: false`.
- PR contendo captura de tela do LogTerminal e link para métricas de latência.
- Checklist de QA (Test Writer) anexado ao PR.
- Seguimento: Performance Optimizer revisitar métricas após 1 semana em produção.

<!-- agent-update:end -->
