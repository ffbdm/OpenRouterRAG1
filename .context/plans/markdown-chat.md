---
id: plan-markdown-chat
ai_update_goal: "Define the stages, owners, and evidence required to complete Markdown Chat."
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

<!-- agent-update:start:plan-markdown-chat -->
# Markdown Chat Plan

> Ajustar o chat do frontend para interpretar markdown que  esta vindo do llm.

## Task Snapshot
- **Primary goal:** Renderizar as respostas do LLM em Markdown (links, listas, trechos de código, tabelas e blocos inline) no `client/src/pages/chat.tsx`, garantindo sanitização, consistência visual e logs coerentes com o fluxo descrito no [Project Overview](../docs/project-overview.md).
- **Success signal:** Quando mensagens vindas de `/api/chat` com Markdown passam a ser renderizadas com estilos do design system, mantêm acessibilidade, passam nos testes automatizados/regressivos e recebem aprovação do Code Reviewer em conformidade com o [Development Workflow](../docs/development-workflow.md).
- **Key references:**
  - [Project Overview](../docs/project-overview.md)
  - [Architecture Notes](../docs/architecture.md)
  - [Development Workflow](../docs/development-workflow.md)
  - [Testing Strategy](../docs/testing-strategy.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Assegura que os novos componentes Markdown sigam padrões de acessibilidade e estilo descritos em `design_guidelines.md`. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Mantém-se em prontidão para investigar regressões no chat quando Markdown quebrar renderizações antigas. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementa o parser Markdown, componentes de renderização e hooks necessários na página de chat. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Modulariza o rendering (`MessageBubble`, utils de sanitização) para evitar duplicação entre chat e futuros canais. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Cobre casos de Markdown (listas, código, links perigosos) em testes de unidade e snapshot dos componentes. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualiza `client/src/pages/chat.tsx` docs internos e `.context/docs/project-overview.md` se necessário para refletir o novo comportamento. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Avalia impacto de bibliotecas de Markdown no bundle e sugere lazy-loading/memoização quando necessário. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Garante sanitização (escape de HTML, whitelist de elementos) conforme recomendações do [Security Guide](../docs/security.md). | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Confirma que o payload de `/api/chat` preserva quebras de linha e metadados necessários para o render. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Lidera a revisão de UX, spacing, e responsividade dos blocos Markdown. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Verifica alinhamento entre contrato cliente-servidor e novas abstrações de renderização para facilitar reuso em futuros canais. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Mantém pipeline atualizada com novas dependências (por exemplo, `react-markdown`) e garante que `npm run build` continue estável. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Confirma que campos `system_instructions` continuam salvos em texto simples e não precisam migração para suportar Markdown. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Valida como o rendering Markdown se comporta em dispositivos móveis ou wrappers futuros. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

## Documentation Touchpoints
| Guide | File | Task Marker | Primary Inputs |
| --- | --- | --- | --- |
| Project Overview | [project-overview.md](../docs/project-overview.md) | agent-update:project-overview | Define o valor do chat RAG e serve de referência para o novo comportamento Markdown na UI |
| Architecture Notes | [architecture.md](../docs/architecture.md) | agent-update:architecture-notes | Explica o fluxo `/api/chat` + SSE, garantindo que o contrato com o frontend continue compatível |
| Development Workflow | [development-workflow.md](../docs/development-workflow.md) | agent-update:development-workflow | Reforça políticas de branch, code review e checkpoints citados nas fases |
| Testing Strategy | [testing-strategy.md](../docs/testing-strategy.md) | agent-update:testing-strategy | Lista os níveis de teste esperados (unit, integration, manual) a serem atualizados com casos Markdown |
| Glossary & Domain Concepts | [glossary.md](../docs/glossary.md) | agent-update:glossary | Mantém consistência de termos (mensagem, instrução, catálogo) quando documentar exemplos Markdown |
| Data Flow & Integrations | [data-flow.md](../docs/data-flow.md) | agent-update:data-flow | Localiza onde o Markdown entra (OpenRouter) e como atravessa o pipeline até o React |
| Security & Compliance Notes | [security.md](../docs/security.md) | agent-update:security | Fonte para controles de sanitização e prevenção de XSS ao renderizar Markdown |
| Tooling & Productivity Guide | [tooling.md](../docs/tooling.md) | agent-update:tooling | Orienta escolha/instalação de libs (`react-markdown`, `remark-gfm`) e ajustes em `npm run dev/build` |

## Risk Assessment
Identify potential blockers, dependencies, and mitigation strategies before beginning work.

### Identified Risks
| Risk | Probability | Impact | Mitigation Strategy | Owner |
| --- | --- | --- | --- | --- |
| Renderização Markdown injeta HTML inseguro e abre XSS | Medium | High | Usar renderer com sanitização (rehype-sanitize), bloquear tags perigosas, revisão do Security Auditor | Security Auditor + Frontend Specialist |
| Bundle aumenta e impacta tempo de carregamento | Low | Medium | Medir com `npm run build -- --analyze`, avaliar importação dinâmica dos módulos Markdown | Performance Optimizer |
| Regressão no contrato `/api/chat` (quebras de linha removidas) | Low | Medium | Backend Specialist valida payloads e adiciona teste de contrato antes do merge | Backend Specialist |
| Layout quebra no mobile com blocos longos de código | Medium | Medium | Frontend Specialist aplica wrappers com scroll horizontal e testa em breakpoints descritos em `design_guidelines.md` | Frontend Specialist |

### Dependencies
- **Internal:** Disponibilidade do time de frontend para revisar `client/src/pages/chat.tsx`, acesso aos logs SSE (`LogTerminal`) e alinhamento com design (documento `design_guidelines.md`).
- **External:** Respostas do OpenRouter contendo Markdown completo; eventual suporte da equipe que mantém a conta Neon/OpenRouter se surgir throttling.
- **Technical:** Biblioteca de renderização Markdown (ex.: `react-markdown` + `remark-gfm` + `rehype-sanitize`) adicionada ao bundle, Node 20+ já exigido por `npm run dev`, e acesso ao Storybook/preview (se usado) para validar componentes.

### Assumptions
- Assume que o servidor continuará retornando respostas como strings simples (sem HTML) e que o schema de `/api/chat` descrito em [Architecture Notes](../docs/architecture.md) permanece estável. **Se falso:** será necessário sincronizar com Backend Specialist para versionar a API ou transportar conteúdo rico via estruturas diferentes.
- Assume que o design atual aceita markdown GitHub-Flavored (listas, tabelas, código) sem criar novos componentes dedicados. **Se falso:** será preciso abrir sub-tarefa com o time de design para revisar tokens de cor e tipografia.
- Assume que o log viewer (SSE) não precisa interpretar Markdown; apenas o painel principal renderiza rico. **Se falso:** replicar estratégia de renderização no `LogTerminal`.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 0.5 pessoa-dia | 1 dia útil | 1 pessoa |
| Phase 2 - Implementation | 1.5 pessoa-dia | 2-3 dias corridos | 2 pessoas |
| Phase 3 - Validation | 0.5 pessoa-dia | 1 dia útil | 1-2 pessoas |
| **Total** | **2.5 pessoa-dias** | **~1 semana (incluindo revisões)** | **-** |

### Required Skills
- Proficiência em React + TypeScript, familiaridade com shadcn/ui, Tailwind e hooks existentes (`useMutation`).
- Conhecimento de bibliotecas Markdown (remark/rehype) e práticas de sanitização de HTML em SPAs.
- Capacidade de escrever testes (Vitest/React Testing Library) e snapshots estáveis.
- Entendimento básico de segurança front-end (XSS) e princípios definidos em [security.md](../docs/security.md).
- Não foram identificados gaps críticos; se o time não tiver experiência em `rehype-sanitize`, prover sprint retro com Security Auditor para revisar exemplos.

### Resource Availability
- **Available:** Frontend Specialist + Feature Developer alocados 50% da sprint; Security Auditor disponível sob demanda para revisão de sanitização.
- **Blocked:** Performance Optimizer parcialmente indisponível durante janela de release, mas pode rodar análise de bundle no fim da fase 2.
- **Escalation:** Eng. responsável pelo monorepo (mention: `@ffbdm`) decide sobre priorização caso dependências externas atrasem.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Frontend Specialist revisa `client/src/pages/chat.tsx` e `LogTerminal` para mapear pontos onde texto é renderizado e onde Markdown deve ser aceito.
2. Feature Developer analisa de-risk de bibliotecas Markdown (licença, bundle) e prepara spike curto comparando `react-markdown` vs `markdown-to-jsx`.
3. Architect Specialist e Security Auditor listam requisitos mínimos (elementos suportados, whitelist, fallback) e registram decisões no plan.
4. Open questions: confirmar com Product/design quais elementos Markdown são prioritários; verificar se transcripts do SSE precisam do mesmo tratamento.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Feature Developer + Frontend Specialist instalam a lib selecionada, criam componente `MarkdownMessage` reutilizável, integram-no no loop de mensagens e ajustam estilos conforme `design_guidelines.md`.
2. Security Auditor reforça sanitização com `rehype-sanitize` (custom schema) e adiciona testes unitários cobrindo payloads suspeitos.
3. Refactoring Specialist separa dados do componente (mensagens, estado) em hooks/utilitários para facilitar testes.
4. Test Writer cobre fluxos com React Testing Library, inclusive fallback para texto puro, e ajusta snapshots.
5. Code Reviewer agenda revisão assíncrona seguindo cadência descrita em [Development Workflow](../docs/development-workflow.md) (branch feature/markdown-chat, PR com checklist).

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Test Writer roda `npm run check` e suites visuais/manuais, anexando capturas do chat com markdown variado.
2. Documentation Writer registra no README/Changelog o novo comportamento; Architecture Notes recebem link para o componente Markdown.
3. Performance Optimizer mede tamanho do bundle antes/depois e compartilha relatório.
4. Devops Specialist atualiza pipelines/locks conforme necessário e monitora `npm run build`/`npm run start`.
5. Equipe reúne evidências (logs SSE, prints) e publica handoff no canal interno.

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
- Action: Reverter commits relacionados ao componente Markdown, remover dependências adicionadas no `package.json` e restaurar o renderer plain-text anterior.
- Data Impact: Nenhum dado é alterado; somente o bundle do cliente muda.
- Estimated Time: 1-2 horas (inclui revisão e nova build).

#### Phase 3 Rollback
- Action: Promover a última release estável na Vercel/ambiente alvo, limpando caches do CDN e sinalizando o incidente.
- Data Impact: Nenhum impacto em banco, apenas UI; logs SSE permanecem inalterados.
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
- PR(s) com descrição detalhada, screenshots antes/depois e links para testes (`npm run check`, resultados Vitest/RTL).
- Capturas de tela/GIF do chat renderizando listas, blocos de código, tabelas e links, anexadas ao handoff.
- Registro de benchmark de bundle + métricas Lighthouse atualizadas.
- Checklist de sanitização assinado pelo Security Auditor.
- Follow-up: abrir ticket para avaliar renderização markdown no `LogTerminal` (owner: Backend Specialist) e monitorar feedback dos agentes reais após rollout (owner: Product/design).

<!-- agent-update:end -->
