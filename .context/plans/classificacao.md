---
id: plan-classificacao
ai_update_goal: "Define the stages, owners, and evidence required to complete Classificacao."
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

<!-- agent-update:start:plan-classificacao -->
# Classificacao Plan

> Mudar o fluxo para que a primeira chamada da LLM retorne apenas uma palavra de intenção (FAQ, CATALOG, MIST, OTHER). O backend decide, com base nessa intenção, se chama `searchFaqs`, `searchCatalog`, ambos ou nenhum, monta um contexto único e envia para a segunda LLM (sem tools) gerar apenas o texto final. As duas chamadas usarão modelos distintos definidos por variáveis de ambiente (ex.: `OPENROUTER_MODEL_CLASSIFY`, `OPENROUTER_MODEL_ANSWER`).

## Task Snapshot
- **Primary goal:** Implementar um fluxo em duas etapas no `/api/chat` onde a primeira chamada da LLM retorna apenas a intenção (`FAQ`, `CATALOG`, `MIST`, `OTHER`); o backend decide quais buscas rodar (FAQ, Catálogo, ambos ou nenhum), monta contexto (“Mensagem do usuário… FAQs… Produtos… Use somente essas informações…”) e envia à segunda LLM sem tools para gerar o texto final. Cada etapa usa modelo separado configurado via env (`OPENROUTER_MODEL_CLASSIFY`, `OPENROUTER_MODEL_ANSWER`).
- **Success signal:** Logs SSE mostram `classification=<INTENCAO>` antes de consultas; debug indica ferramentas realmente chamadas (`usedTools=[...]`) e `llmCalls` coerente com buscas (`0` sem busca, `1` para FAQ ou Catálogo, `2` para ambos); cada chamada registra qual modelo foi usado (classify vs. answer) a partir das envs; respostas usam somente o contexto construído e não incluem a palavra de intenção; cenários cobrem cada classe.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)
  - [Project Overview](../docs/project-overview.md)
  - [Architecture Notes](../docs/architecture.md)
  - [Data Flow & Integrations](../docs/data-flow.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que o novo fluxo de duas chamadas siga padrões e não quebre contratos existentes. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Acompanhar regressões do `/api/chat` e corrigir falhas de classificação ou tool usage. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar a primeira chamada de classificação, roteamento de tools e ajuste do prompt. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Simplificar `server/routes.ts` para isolar etapas (classificação vs. resposta) e manter legibilidade. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Criar cenários cobrindo as quatro intenções e ausência de tool_calls. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar docs/planos com o novo fluxo de classificação e instruções do prompt. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Avaliar impacto de 2 chamadas no tempo médio de resposta e custos de token. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisar logs e payloads para evitar vazamento de intents ou tokens em SSE. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Desenhar o contrato da primeira chamada (somente intenção) e encaixe na rota Express. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Garantir que o SPA exiba logs e estados intermediários sem mudar UX principal. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Validar que a divisão em duas etapas mantém coerência com decisões de arquitetura atuais. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Ajustar observabilidade/alertas se tempo de resposta ou taxa de erro mudar. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Checar se chamadas de busca continuam usando Drizzle/Neon sem novas migrações. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Sem ação direta; manter alinhamento caso clientes móveis consumam `/api/chat`. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| LLM classificar errado e pular tools | Medium | High | Prompt explícito para retornar só uma palavra; logs e testes de prompts por classe | Backend Specialist |
| Aumento de latência por 2 chamadas | Medium | Medium | Medir tempo médio com SSE; fallback para resposta única quando sem dados | Performance Optimizer |
| Respostas vazando palavra de intenção para o usuário | Low | Medium | Filtrar intent do histórico antes da resposta final; validar manualmente | Code Reviewer |
| Configuração incorreta de modelos (classificação vs. resposta) | Low | Medium | Validar envs `OPENROUTER_MODEL_CLASSIFY` e `OPENROUTER_MODEL_ANSWER` em dev/stage; logs devem registrar modelo usado | Devops Specialist |
| Cobertura de testes insuficiente para intents | Low | Medium | Criar testes unitários e mocks de tool_calls para cada classe e mapeamento de tools | Test Writer |

### Dependencies
- **Internal:** Manter contratos de `/api/chat` e SSE em `client/`; alinhamento com planos em `plans/` e `design_guidelines.md` para UX.
- **External:** Disponibilidade do OpenRouter para duas chamadas sequenciais; Neon/Postgres para buscas em FAQ/Catálogo.
- **Technical:** Prompt e tools definidos em `server/routes.ts`; schemas em `shared/schema.ts`; envs `OPENROUTER_API_KEY`, `DATABASE_URL`, `OPENROUTER_MODEL_CLASSIFY`, `OPENROUTER_MODEL_ANSWER` configurados.

### Assumptions
- Modelo consegue seguir instrução de retornar apenas a palavra de intenção sem demais texto; se falhar, precisaremos pós-processar a saída.
- Estrutura de tools (`searchFaqs`, `searchCatalog`) permanece igual; se mudar, ajuste de prompts e mocks de testes será necessário.
- O cliente não requer mudança visual para exibir a primeira fase; se surgir demanda, incluir estado de "classificando" na UI.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1 person-day | 1-2 days | 1-2 people |
| Phase 2 - Implementation | 3 person-days | 3-5 days | 2-3 people |
| Phase 3 - Validation | 1 person-day | 1-2 days | 1-2 people |
| **Total** | **5 person-days** | **5-9 days** | **-** |

### Required Skills
- Express/TypeScript avançado, manipulação de OpenRouter e ferramentas de function calling.
- Familiaridade com React Query e SSE para validar impactos no cliente.
- Conforto com Drizzle/Neon para inspecionar consultas e logs.
- Gap potencial: prompt engineering para garantir intenções únicas; reservar tempo para ajustes rápidos.

### Resource Availability
- **Available:** Backend + Frontend devs alinhados ao RAG; reviewers habituados ao fluxo atual.
- **Blocked:** Sem bloqueios conhecidos; dependência de agenda do Code Reviewer para merge.
- **Escalation:** Eng. responsável pelo backend (owner do `/api/chat`) para destravar decisões de prompt/tooling.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Mapear no `server/routes.ts` pontos de inserção da chamada de classificação e validar contratos com client; definir formato da resposta com única palavra de intenção (Backend Specialist).
2. Revisar docs em `project-overview.md`, `architecture.md` e `data-flow.md` para garantir aderência ao desenho atual (Architect Specialist).
3. Definir formato exato da resposta de classificação e logs SSE esperados; listar casos de borda (`OTHER`, nenhuma tool) (Feature Developer).
4. Definir nomes finais das envs dos modelos (ex.: `OPENROUTER_MODEL_CLASSIFY`, `OPENROUTER_MODEL_ANSWER`) e checar disponibilidade/configuração (Devops Specialist).
4. Registrar perguntas abertas: pós-processamento da intenção? cache? impacto de custo? (Product/Eng owner).

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Implementar chamada 1 (classificação) e roteamento condicional para tools baseado na palavra retornada; garantir que a intenção não vaza para o usuário e que a segunda LLM não usa tools (Feature Developer + Backend Specialist).
2. Refatorar logs/debug para incluir `classification`, `usedTools`, `llmCalls` coerente com buscas (`0` sem busca, `1` para uma, `2` para ambas) e o modelo usado em cada chamada (classify vs. answer), além de estado de `databaseQueried` coerente com `data-flow.md` (Refactoring Specialist).
3. Configurar uso de envs `OPENROUTER_MODEL_CLASSIFY` e `OPENROUTER_MODEL_ANSWER` na rota e validar fallback/erros quando ausentes (Devops Specialist + Backend Specialist).
4. Criar testes unitários/integration mocks para intenções, mapeamento de tool_calls e seleção de modelos; validar que respostas sem dados mantêm `llmCalls=1` (Test Writer).
5. Revisar código com Code Reviewer seguindo `architecture.md` e playbooks; ajustar prompt conforme feedback.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Validar manualmente cada classe (`FAQ`, `CATALOG`, `MIST`, `OTHER`) com prompts de exemplo e checar se `usedTools`/`llmCalls` e modelos usados condizem (FAQ→faq/`1` com modelo classify/answer corretos, CATALOG→catalog/`1`, MIST→ambos/`2`, OTHER→nenhum/`0`); confirmar logs SSE e resposta final (Test Writer).
2. Atualizar documentação (`data-flow.md` se necessário) e notas de plano com novo fluxo sem tools na segunda chamada; preparar resumo para PR (Documentation Writer).
3. Coletar métricas de latência/custo de tokens e ajustar parâmetros se necessário (Performance Optimizer).
4. Handoff para QA/Stakeholders com instruções de rollback e pontos de monitoramento (Architect/Devops Specialist).

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
- Action: Reverter commits/pull request que introduziu o fluxo de classificação; restaurar `routes.ts` para chamada única.
- Data Impact: Nenhum impacto em dados (somente lógica de orquestração); manter integridade de logs.
- Estimated Time: 1-2 hours

#### Phase 3 Rollback
- Action: Rollback de deploy para versão anterior em produção e limpar feature flags (se usadas) para desativar classificação.
- Data Impact: Nenhum dado mutado; apenas tráfego volta ao fluxo antigo.
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
- Logs SSE anotando cada classe de intenção, modelos usados (classify/answer), `usedTools`, `llmCalls` (0/1/2 conforme buscas) e tool_calls correspondentes.
- PR com descrição do fluxo em duas etapas (classificação + resposta sem tools) e links para docs atualizados.
- Resultados de testes unitários/mocks e roteiros manuais para cada classe/mapeamento de tools.
- Métricas de latência/custos antes/depois para justificar impacto.
- Follow-up: monitorar taxas de classificação incorreta, `usedTools`/`llmCalls` ou modelos inconsistentes na primeira semana; abrir issue se >5% dos casos exigirem fallback manual (Owner: Backend Specialist).

<!-- agent-update:end -->
