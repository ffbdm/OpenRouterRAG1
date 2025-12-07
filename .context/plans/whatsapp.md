---
id: plan-whatsapp
ai_update_goal: "Define the stages, owners, and evidence required to complete Whatsapp."
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

<!-- agent-update:start:plan-whatsapp -->
# Whatsapp Plan

> Conectar o backend atual ao WhatsApp Cloud API com um webhook que transforma mensagens recebidas em chamadas ao `/api/chat` e responde ao usuário pelo Messages API, mantendo o mesmo fluxo de intent/FAQ/LLM.

## Task Snapshot
- **Primary goal:** Entregar um canal WhatsApp reutilizando o endpoint `/api/chat` (sessionId + message) para gerar respostas e devolvê-las via WhatsApp Cloud API.
- **Success signal:** Webhook validado pelo Meta (challenge OK), mensagem de teste no número sandbox recebe resposta coerente em <5s, logs mostram chamada única por `message_id` sem duplicidade.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir aderência às convenções do Express/TypeScript e evitar regressões em `/api/chat`. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Tratar falhas de webhook/HTTP, lidar com duplicidade de eventos e erros do Messages API. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar rotas WhatsApp (GET verify + POST messages), mapear sessão `wa_id -> sessionId`, acionar `/api/chat` e enviar resposta. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Isolar integração WhatsApp em módulo dedicado reutilizando utilitários de logging/storage existentes. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Adicionar testes de rota simulando webhook POST/GET e mocks do Messages API. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar README/planos com envs WhatsApp, fluxo de teste manual e passos de registro do webhook. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Monitorar latência adicional ao encadear `/api/chat` e envio WhatsApp, propor caching mínimo para intents repetidas. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisar validação `X-Hub-Signature-256`, sanitização do payload e proteção de tokens. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Desenhar handlers Express compatíveis com o fluxo atual (SSE/logging) e idempotência por `message_id`. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Confirmar se o canal WhatsApp precisa refletir no UI (histórico ou sinalização) e alinhar qualquer ajuste mínimo. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Definir contrato de sessão e limites de responsabilidade (WhatsApp adapter chama `/api/chat` como caixa-preta). | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Configurar webhook na Meta, URL pública, secrets no deploy (`WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`). | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Avaliar necessidade de persistir mapping de sessão WhatsApp ou reutilizar storage existente sem migrations. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Sem app nativo; confirmar que experiência via WhatsApp cobre mobile users e não requer cliente dedicado. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| WhatsApp Cloud API (Context7) | [developers.facebook.com/docs/whatsapp](https://developers.facebook.com/docs/whatsapp) | agent-update:whatsapp-docs | Webhook verify (`hub.challenge`, `X-Hub-Signature-256`), payload shape (`entry[0].changes[].value.messages[]`), send text via `POST /{phone_number_id}/messages` |

## Risk Assessment
Identify potential blockers, dependencies, and mitigation strategies before beginning work.

### Identified Risks
| Risk | Probability | Impact | Mitigation Strategy | Owner |
| --- | --- | --- | --- | --- |
| Webhook validation falhar (verify token ou assinatura) | Medium | High | Documentar tokens, validar `hub.challenge` e `X-Hub-Signature-256` em dev antes de apontar produção | Security Auditor |
| Duplicidade de eventos por reenvio do Meta | Medium | Medium | Guardar `message_id` em cache/DB para idempotência antes de chamar `/api/chat` | Backend Specialist |
| Latência alta ao encadear LLM + WhatsApp | Low | Medium | Medir tempo total, aplicar timeout e mensagens de fallback ao usuário | Performance Optimizer |
| Falta de credenciais ou sandbox indisponível | Medium | Medium | Checklist de envs e plano B com `curl` simulando webhook local | Devops Specialist |

### Dependencies
- **Internal:** Endpoint `/api/chat`, storage/logging em `server/storage.ts`/`log-stream.ts`, roteamento Express em `server/routes.ts`.
- **External:** WhatsApp Cloud API (phone number ID, access token), configuração do webhook na Meta App (verify token), URL pública acessível.
- **Technical:** Suporte a HMAC SHA-256 para validar `X-Hub-Signature-256`, captura de `wa_id` -> `sessionId`, timezone/locale português já existente.

### Assumptions
- `/api/chat` permanece estável e retorna `{ reply }` sincronicamente.
- Um único número WhatsApp é suficiente; não há multi-tenant inicial.
- `sessionId` pode ser derivado de `wa_id` (remetente) e persistido sem nova tabela; se não, será preciso schema extra ou cache.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 0.5 pessoa-dia | 1-2 dias | 1-2 pessoas |
| Phase 2 - Implementation | 2 pessoa-dias | 3-5 dias | 2-3 pessoas |
| Phase 3 - Validation | 0.5 pessoa-dia | 1-2 dias | 1-2 pessoas |
| **Total** | **3 pessoa-dias** | **5-9 dias corridos** | **-** |

### Required Skills
- Express/TypeScript, integração com APIs Meta (WhatsApp Cloud), assinaturas HMAC, automação de testes HTTP, logging/observabilidade.
- Se faltar experiência com verificação `X-Hub-Signature-256`, alocar tempo para leitura da doc oficial.

### Resource Availability
- **Available:** Backend + DevOps para rotas e secrets; QA para teste manual com número sandbox.
- **Blocked:** Sem número de produção até conclusão dos testes; dependência de quem administra a Meta App.
- **Escalation:** Eng. responsável pela integração (ex.: lead backend) para destravar tokens/URL pública.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Mapear payloads WhatsApp (mensagens de texto) e contrato de verificação do webhook; Owner: Backend Specialist.
2. Ler docs oficiais via Context7 (webhook verify `hub.challenge`, validação `X-Hub-Signature-256`, payload `entry[].changes[].value.messages[].text.body`, envio `POST /{phone_number_id}/messages`); Owner: Backend/Security.
3. Decidir derivação de `sessionId` a partir de `wa_id` e política de idempotência (`message_id`); Owner: Architect Specialist.
4. Confirmar envs necessários e processo de registro do webhook na Meta; Owner: Devops Specialist.
5. Levantar perguntas abertas (mensagens de mídia? localização? suporte inicial apenas texto?); Owner: Product/Backend.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Implementar rota GET `/webhooks/whatsapp` para responder `hub.challenge` com verify token; Owner: Feature Developer.
2. Implementar POST `/webhooks/whatsapp` consumindo mensagens texto, validando assinatura `X-Hub-Signature-256`, extraindo `wa_id`/`message_id`/texto; Owner: Security Auditor + Backend Specialist.
3. Chamar `/api/chat` com `{ sessionId: derivedFromWaId, message }`, registrar logs; Owner: Feature Developer.
4. Enviar resposta via WhatsApp Messages API (phone number ID + access token), com handling de falhas e retries leves; Owner: Feature Developer.
5. Opcional: persistir/emitir métricas e idempotência (cache/DB) para evitar dupla chamada; Owner: Refactoring Specialist.
6. Adicionar testes automatizados de rotas (mocks do Messages API) e fixtures de webhook; Owner: Test Writer.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Executar teste manual end-to-end com número sandbox (enviar mensagem e verificar resposta e logs SSE); Owner: QA/Test Writer.
2. Validar tratamento de assinatura inválida e eventos duplicados; Owner: Security Auditor.
3. Atualizar docs (`README.md` ou `plans/README.md`) com envs e passos de registro de webhook; Owner: Documentation Writer.
4. Preparar runbook de fallback/rollback e checklist de deploy; Owner: Devops Specialist.

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
- Action: Reverter commits das rotas WhatsApp e restaurar configs de webhook para estado anterior; desligar URL no Meta.
- Data Impact: Nenhum (sem migrations). Cache/ids podem ser limpos.
- Estimated Time: 1-2 horas

#### Phase 3 Rollback
- Action: Rollback do deploy para versão sem WhatsApp, remover secrets do ambiente e suspender webhook.
- Data Impact: Nenhum dado crítico; sessões WhatsApp ficam órfãs mas serão reprocessadas ao reativar.
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
- Logs de webhook (request/response), print do `hub.challenge` resolvido, cURLs de teste, transcript de conversa real no sandbox, PR links.
- Follow-up: confirmar suporte futuro a mídia/quick replies; decidir persistência de sessões em DB se cache não for suficiente; Owner: Architect/Backend.

<!-- agent-update:end -->
