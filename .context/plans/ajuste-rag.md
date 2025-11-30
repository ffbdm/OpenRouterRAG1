---
id: plan-ajuste-rag
ai_update_goal: "Define the stages, owners, and evidence required to complete Ajuste Rag."
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

<!-- agent-update:start:plan-ajuste-rag -->
# Ajuste Rag Plan

Resolver o falso-positivo observado na tool `searchCatalog` (consulta "pesticida para uva" retornando apenas o fungicida Tino) ao fortalecer o ranking híbrido, revisar pesos lexicais e documentar evidências que provem a correção antes de liberar o fluxo para QA.

## Task Snapshot
- **Primary goal:** Garantir que `searchCatalog` retorne produtos corretos para combinações cultura+tratamento, ajustando scoring lexical/vetorial e enriquecendo o dataset de avaliação.
- **Success signal:** Logs de `/api/chat` mostram `searchCatalog total≥3` com correspondências para a cultura solicitada em ≥80% dos cenários de QA regressivo e nenhuma resposta incorreta chega ao usuário final.
- **Key references:**
  - [Architecture Notes — System Architecture Overview](../docs/architecture.md#system-architecture-overview)
  - [Data Flow & Integrations — High-level Flow](../docs/data-flow.md#high-level-flow)
  - [Testing Strategy — Retrieval suites](../docs/testing-strategy.md)
  - [Glossary & Domain Concepts — Termos de catálogo](../docs/glossary.md)
  - [Agent Handbook](../agents/README.md)
  - [Hybrid RAG Draft](../../plans/rag-system-hybrid-design.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Validar alterações em `server/storage.ts` e `server/routes.ts`, garantindo logs consistentes para SSE. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Reproduzir o bug "pesticida para uva" e confirmar que o fix impede regressões similares. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar ajustes no scoring híbrido, novo dataset lexical e flags de feature. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Limpar duplicações entre `searchCatalog`, `catalog-hybrid.ts` e utilitários de normalização. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Criar testes para consultas compostas (cultura + insumo) e suite de regressão do catálogo. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar `plans/rag-system-hybrid-design.md` e `README` com o comportamento corrigido. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Monitorar tempos `vectorMs`/`lexicalMs` evitando regressão de latência ao adicionar filtros. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Garantir que novos logs e datasets não exponham dados sensíveis (IA recebe apenas texto sanitizado). | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Liderar alterações em `server/storage.ts`, `catalog-hybrid.ts` e `routes.ts`. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Avaliar se o `LogTerminal` precisa de novas labels para diferenciar `lexicalOnly` e `hybrid`. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Revisar alinhamento com o plano híbrido e propor fallback automático se o LLM ignorar a tool. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Coordenar rollout com flag gradual e monitoramento em Vercel logs. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Criar views/materialized queries se precisarmos reforçar filtros por cultura. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Alinhar contrato `/api/chat` com clientes móveis e garantir consistência do debug payload. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

## Documentation Touchpoints
| Guide | File | Task Marker | Primary Inputs |
| --- | --- | --- | --- |
| Project Overview | [project-overview.md](../docs/project-overview.md) | agent-update:project-overview | Contexto de chat RAG e prioridades de catálogo |
| Architecture Notes | [architecture.md](../docs/architecture.md) | agent-update:architecture-notes | Fluxo `/api/chat`, limites de tool forcing |
| Development Workflow | [development-workflow.md](../docs/development-workflow.md) | agent-update:development-workflow | Branching + convenções de feature flag |
| Testing Strategy | [testing-strategy.md](../docs/testing-strategy.md) | agent-update:testing-strategy | Critérios para suites de regressão do catálogo |
| Glossary & Domain Concepts | [glossary.md](../docs/glossary.md) | agent-update:glossary | Canon para termos de cultura, pragas, defensivos |
| Data Flow & Integrations | [data-flow.md](../docs/data-flow.md) | agent-update:data-flow | Sequência de tool calls e SSE logging |
| Security & Compliance Notes | [security.md](../docs/security.md) | agent-update:security | Sanitização de contexto enviado ao LLM |
| Tooling & Productivity Guide | [tooling.md](../docs/tooling.md) | agent-update:tooling | Scripts `npm run check`, `npm run db:push`, seeds |

## Risk Assessment
Identify potential blockers, dependencies, and mitigation strategies before beginning work.

### Identified Risks
| Risk | Probability | Impact | Mitigation Strategy | Owner |
| --- | --- | --- | --- | --- |
| Reintroduzir falso-positivo para outras culturas ao ajustar pesos lexicais | Medium | High | Criar suite de regressão com 10 consultas compostas antes de merge | Test Writer |
| Latência dobrar ao adicionar filtros extras | Low | Medium | Performance Optimizer monitora `vectorMs` via logs e adiciona benchmarks locais | Performance Optimizer |
| Dependência do modelo de embeddings indisponível no OpenRouter | Low | High | Cache local de embeddings mais usados e fallback para fluxo 100% lexical | Backend Specialist |

### Dependencies
- **Internal:** Disponibilidade do storage (`server/storage.ts`), scripts de seed e SSE para observabilidade.
- **External:** OpenRouter para embeddings/chat, Neon/Postgres para consultas híbridas.
- **Technical:** Feature flag no Express (`HYBRID_SEARCH_ENHANCED`), métricas de log e dataset etiquetado para avaliação.

### Assumptions
- Taxonomia de culturas permanece estável; se nomes mudarem, o dicionário lexical deve ser re-gerado.
- `textPreview` em `catalog_files` já está preenchido; caso contrário, será preciso adicionar pipeline de parsing antes da Fase 2.
- Volume atual (<5k itens) continua cabendo no pgvector existente; se crescer, novas estratégias de sharding serão necessárias.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 2 person-days | 2-3 days | 2 people (Backend + Product Ops) |
| Phase 2 - Implementation | 5 person-days | 1 week | 3 people (Backend, Refactoring, Test) |
| Phase 3 - Validation | 2 person-days | 3 days | 2 people (QA + DevOps) |
| **Total** | **9 person-days** | **~2 weeks corridas** | **-** |

### Required Skills
- Drizzle + pgvector, análise de logs SSE, tuning lexical.
- Conhecimento de português agrícola para montar sinônimos/lemmatização.
- Observabilidade (Grafana/Vercel logs) e testes de carga leves.
- Gap identificado: não há dicionário atualizado de culturas → precisamos de apoio do agrônomo parceiro para validar termos antes da Fase 2.

### Resource Availability
- **Available:** Fabio (Backend Specialist), Marina (Test Writer), Lucas (DevOps), Ana (Product Ops para curadoria de termos).
- **Blocked:** UX/front-end está dedicado ao redesign do chat; portanto, apenas consultas leves para labels do LogTerminal estão liberadas.
- **Escalation:** Procurar Camila (Eng Lead) caso o acesso a dados de catálogo precise de priorização adicional.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Backend Specialist + Bug Fixer: reproduzir o cenário "pesticida para uva" em ambiente dev, coletando dumps `searchCatalog`/`catalog-hybrid` e confirmando thresholds atuais.
2. Product Ops + Documentation Writer: catalogar termos essenciais (cultura, tipo de defensivo, marca) usando `plans/rag-system-hybrid-design.md` como base e registrar lacunas.
3. Architect Specialist: definir qual sinal (lexical score, tags ou match by culture) determina sucesso e documentar no plano.
4. Capturar perguntas abertas (ex.: precisamos de campos estruturados para cultura?) e priorizar respostas antes de iniciar Fase 2.

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Feature Developer + Refactoring Specialist: extrair módulo `catalogLexicalRanker` com boosting por cultura, tags e tipo de produto, respeitando expectativas de `Architecture Notes`.
2. Backend Specialist: adicionar normalização de sinônimos (uva → vitis, fungicida vs pesticida) em `server/text-utils.ts` e atualizar `searchCatalogHybrid` para usar novos pesos.
3. Test Writer: criar fixtures em `tests/catalog-hybrid.test.ts` cobrindo perguntas compostas e validar thresholds.
4. DevOps Specialist: introduzir flag `HYBRID_SEARCH_STRICT=true` no deploy e preparar dashboards de latência.
5. Documentation Writer: atualizar `README.md` e `plans/rag-system-hybrid-design.md` com a nova ordem de resultados.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Test Writer + Bug Fixer: rodar suíte regressiva (`npm test -- catalog-hybrid`) e revisar logs SSE em ambiente de staging com 10 prompts reais.
2. Performance Optimizer: comparar tempos (`vectorMs`, `lexicalMs`, `totalMs`) antes/depois e anexar gráfico ao PR.
3. Documentation Writer: registrar checklist de QA e notas de rollout em `plans/ajuste-rag.md` e no changelog.
4. DevOps Specialist: validar que feature flag pode ser ligada em produção e que rollback está documentado.

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
- Action: Reverter PRs relacionados ao ranker híbrido, resetar flag `HYBRID_SEARCH_STRICT`, restaurar dataset de sinônimos anterior e reimplantar versão estável.
- Data Impact: Nenhum dado crítico; apenas logs e métricas históricas mudam.
- Estimated Time: 2 horas (inclui verificação via `/api/rag/search`).

#### Phase 3 Rollback
- Action: Rolagem completa do deploy para a release anterior e limpeza de feature flags em produção.
- Data Impact: Nenhuma sincronização de dados, mas remover dashboards temporários de latência.
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
- Logs SSE de staging mostrando `searchCatalog :: total>=3 vetorial>=1 lexical>=1` para as 10 consultas alvo — Owner: Backend Specialist.
- Link do PR contendo ajustes no ranker + captura de tela do `LogTerminal` — Owner: Code Reviewer.
- Resultado da suíte `tests/catalog-hybrid.test.ts` anexado ao PR e armazenado no pipeline — Owner: Test Writer.
- Nota de release destacando mudança de comportamento e instruções de fallback — Owner: Documentation Writer.
- Follow-up: Em 2 semanas, Performance Optimizer revisa métricas de assertividade com dados reais e decide se novos sinônimos são necessários.

<!-- agent-update:end -->
