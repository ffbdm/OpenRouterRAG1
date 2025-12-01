---
id: plan-double-instructions
ai_update_goal: "Define the stages, owners, and evidence required to complete Double Instructions."
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

<!-- agent-update:start:plan-double-instructions -->
# Double Instructions Plan

> Quero ter dois instructions (role: system) para as chamadas da IA. A primeira é uma instruction para explicar como a IA ira fazer a busca, quais functions possui e como trazer os dados. A segunda é explicando como utilizar os dados recebidos, tratar e enviar para o usuario (de forma estruturada) com boa apresentaçao.s

## Task Snapshot
- **Primary goal:** Delinear como o `/api/chat` passará a aplicar duas mensagens `system` distintas — a primeira explicando como a IA consulta `searchFaqs`/`searchCatalog` e coleta contexto, e a segunda orientando o pós-processamento/entrega estruturada — mantendo o conteúdo versionado em `system_instructions` e exposto na UI.
- **Success signal:** Logs do SSE e do backend mostram duas mensagens `system` ordenadas, o painel de instruções lista/edita cada prompt separadamente, e uma rodada manual de chat comprova que a IA usa dados buscados e responde em formato estruturado sem regressões de tool calls.
- **Key references:**
  - [Documentation Index](../docs/README.md) — mapa das seções que descrevem `system_instructions`, fluxo do `/api/chat` e scripts obrigatórios.
  - [Agent Handbook](../agents/README.md) — playbooks dos agentes listados abaixo que conduzirão cada fase.
  - [Plans Index](./README.md) — garante alinhamento com demais planos dependentes (ex.: "Add UI Instructions For Changes").

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que alterações em `server/routes.ts`, `server/instruction-*.ts` e componentes React mantenham padrões de `AGENTS.md` e passem por revisões focadas em prompts. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Monitorar regressões de tool calls/logs durante o rollout, reproduzindo erros via SSE e ajustando fallback. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar o encadeamento de duas instruções, novos slugs e hooks no `/api/chat`. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Extrair helpers de composição de prompts para manter o código enxuto e testável. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Definir e executar o plano de testes manuais (chat feliz, ausência de dados, tool forçada) descrito em `docs/testing-strategy.md`. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar `docs/project-overview.md`, `docs/data-flow.md` e o texto do `InstructionsPanel` descrevendo a nova divisão de prompts. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Medir o impacto de duas mensagens extras nos tempos registrados em `logHybridStats` e OpenRouter. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisar se as novas instruções não expõem segredos e continuam respeitando as regras de logging de `docs/security.md`. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Ajustar armazenamento (`storage.listInstructions`, `ensureDefaultInstructions`) e garantir que a ordem das instruções seja determinística. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Atualizar `client/src/components/InstructionsPanel.tsx` e páginas relacionadas para destacar os dois prompts do escopo chat. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Confirmar que o desenho segue a topologia descrita em `docs/architecture.md`, evitando dependências circulares. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Garantir que os pipelines (`npm run check`, `npm run build`) e variáveis de ambiente sejam atualizados antes do deploy. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Curar os registros em `system_instructions`, seeds e migrações caso seja necessário adicionar metadados ou ordenar slugs. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Validar responsividade da nova experiência de instruções em dispositivos móveis/tablets usados pelo time de campo. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

## Documentation Touchpoints
| Guide | File | Task Marker | Primary Inputs |
| --- | --- | --- | --- |
| Project Overview | [project-overview.md](../docs/project-overview.md) | agent-update:project-overview | Seções "Quick Facts" e "Instructions" mostram como `system_instructions` alimenta `/api/instructions` e o prompt do chat. |
| Architecture Notes | [architecture.md](../docs/architecture.md) | agent-update:architecture-notes | Fluxo de requisição e diagrama de sequência indicam onde injetar duas mensagens `system` sem quebrar tool calls. |
| Development Workflow | [development-workflow.md](../docs/development-workflow.md) | agent-update:development-workflow | Scripts `npm run dev/check/build`, política de branches e checklist de PRs que precisarão documentar os dois prompts. |
| Testing Strategy | [testing-strategy.md](../docs/testing-strategy.md) | agent-update:testing-strategy | Guia de testes manuais e `npm run check` usados para validar o comportamento antes/pois-depois. |
| Glossary & Domain Concepts | [glossary.md](../docs/glossary.md) | agent-update:glossary | Termos "RAG Chat" e "Catalog Tool" ajudam a nomear claramente cada instrução. |
| Data Flow & Integrations | [data-flow.md](../docs/data-flow.md) | agent-update:data-flow | Passos 2-4 e seção "Tool payload tracing" definem o local exato dos prompts e logs. |
| Security & Compliance Notes | [security.md](../docs/security.md) | agent-update:security | Restrições de logging e manipulação de segredos ao duplicar mensagens `system`. |
| Tooling & Productivity Guide | [tooling.md](../docs/tooling.md) | agent-update:tooling | Scripts `npm run db:push`, `npm run tsx scripts/seedCatalog.ts` e uso de tsx para ajustes rápidos durante o rollout. |

## Risk Assessment
Identify potential blockers, dependencies, and mitigation strategies before beginning work.

### Identified Risks
| Risk | Probability | Impact | Mitigation Strategy | Owner |
| --- | --- | --- | --- | --- |
| Conflitos entre as duas mensagens `system` e o comportamento de tool calls. | Medium | High | Prototipar no Phase 1, validar com `architect-specialist` e manter logs do `logToolPayload` ligados durante o rollout. | Architect Specialist |
| UI não reflete claramente os dois prompts, levando a edições incorretas. | Medium | Medium | Frontend Specialist ajusta `InstructionsPanel` com rótulos distintos e documentação contextual. | Frontend Specialist |
| Latência/uso da OpenRouter aumenta por conta de prompts maiores. | Low | Medium | Performance Optimizer compara tempos de `logHybridStats` e ajusta instruções para permanecerem concisas (<800 chars). | Performance Optimizer |

### Dependencies
- **Internal:** `storage.listInstructions`/`getInstructionBySlug`, painel `InstructionsPanel`, endpoints `/api/instructions` e `/api/chat`, seeds definidos em `server/instruction-defaults.ts`.
- **External:** OpenRouter (precisa continuar aceitando múltiplas mensagens `system`), Neon/Postgres para persistir novos slugs, Vercel Blob apenas se instruções fizerem referência a anexos (sem mudanças previstas).
- **Technical:** A ordem das mensagens depende da serialização atual de `messages` no OpenRouter; necessidade de manter `node >=20`, env vars (`OPENROUTER_API_KEY`, `DATABASE_URL`) carregadas e migrations sincronizadas via `npm run db:push`.

### Assumptions
- O schema `system_instructions` atual suporta dois registros adicionais para o escopo chat sem exigir nova coluna; caso precise de metadata extra, abriremos uma migration adicional antes do Phase 2.
- OpenRouter preserva a ordem em que as mensagens `system` são enviadas; se isso não ocorrer, será necessário refatorar para uma única mensagem concatenada como fallback.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1.5 pessoa-dia | 2 dias úteis | 1-2 pessoas |
| Phase 2 - Implementation | 3 pessoa-dias | 4-5 dias corridos | 2-3 pessoas |
| Phase 3 - Validation | 1 pessoa-dia | 1-2 dias úteis | 1-2 pessoas |
| **Total** | **5.5 pessoa-dias** | **~1,5 semana** | **-** |

### Required Skills
- Drizzle ORM + TypeScript avançado para manipular `system_instructions` e storage compartilhado.
- React + shadcn/ui + Tailwind para atualizar o painel de instruções e garantir responsividade.
- Engenharia de prompts/OpenRouter (funções/tools) para escrever instruções curtas, auditáveis e compatíveis com dois papéis.
- Observabilidade e logging (`logToolPayload`, SSE) para validar o comportamento em produção.

### Resource Availability
- **Available:** Maintainer (Fabio) com 0,5 dia/dia para revisões e ajustes de schema; Feature Developer (AI/Copilot) tempo integral na sprint; Documentation Writer disponível 0,25 dia/dia para atualizar `.context/docs`.
- **Blocked:** Mobile Specialist só disponível mediante agendamento (slot semanal); Performance Optimizer tem 0,25 dia/dia e dependerá de janelas sem deploy crítico.
- **Escalation:** Fabio Fernandes (maintainer) ou whoever estiver de plantão na fila de planos.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Inventariar prompts atuais: Backend Specialist + Architect Specialist revisam `server/routes.ts`, `server/instruction-defaults.ts` e registros existentes para mapear lacunas (ex.: ausência de instrução pós-busca) e definir novos slugs.
2. Capturar dúvidas abertas (ordenação, limites de tamanho, requisitos de audit trail) no plano e alinhar com Design/Produto usando referências de `docs/project-overview.md` e `docs/glossary.md`. Responsável: Documentation Writer.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Backend + Feature Developer: criar dois novos slugs/seeds (`buscar-dados`, `responder-usuario`), ajustar `storage.listInstructions` para ordenar instruções e atualizar `/api/chat` para empilhar as duas mensagens `system`, mantendo logs descritos em `docs/data-flow.md`.
2. Frontend Specialist + Documentation Writer: atualizar `InstructionsPanel`/páginas para exibir descrições separadas, adicionar tooltips sobre o objetivo de cada prompt e registrar mudanças em `docs/project-overview.md` e `docs/tooling.md`. Revisões semanais conduzidas pelo Code Reviewer.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Test Writer + Bug Fixer executam `npm run dev`, cenários de chat (FAQ puro, catálogo forçado, mensagens sem dados) e registram logs/SSE provando uso das duas instruções. Validar `npm run check`/`npm run build` antes de sinalizar PR.
2. Documentation Writer compila evidências (capturas do SSE, export `/api/instructions`, resumo no README) e publica check-list de rollout + passos de fallback. Security Auditor assina se nenhuma informação sensível foi introduzida.

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
- Action: Reverter commits relacionados (backend/UI), remover os novos registros de `system_instructions` via `DELETE FROM system_instructions WHERE slug IN (...)`, rodar `npm run build` e redeployar versão anterior.
- Data Impact: Perda apenas das instruções recém-criadas; não há impacto em dados de FAQ/catalogo.
- Estimated Time: ~2-3 horas incluindo revisão e smoke test.

#### Phase 3 Rollback
- Action: Efetuar rollback de deploy (Vercel), restaurar instruções anteriores via seed/backup e invalidar caches do SPA.
- Data Impact: Necessário reimportar as instruções antigas, mas nenhum dado de usuário é afetado.
- Estimated Time: ~1-2 horas.

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
- Evidências: (a) Capturas do SSE mostrando as duas mensagens `system` e o consumo dos resultados; (b) Resposta de `GET /api/instructions` com os novos slugs e timestamps; (c) Relato dos testes manuais (inputs, outputs, status de comandos `npm run check`/`npm run build`).
- Follow-up: (1) Abrir tarefa para automatizar validação das instruções via CI (owner: Devops Specialist); (2) Documentar lições aprendidas em `docs/development-workflow.md` quanto à manutenção de múltiplos prompts (owner: Documentation Writer).

<!-- agent-update:end -->
