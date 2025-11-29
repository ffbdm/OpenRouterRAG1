---
id: plan-habilitar-parsing-no-backend
ai_update_goal: "Define the stages, owners, and evidence required to complete Habilitar Parsing No Backend."
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

<!-- agent-update:start:plan-habilitar-parsing-no-backend -->
# Habilitar Parsing No Backend Plan

> Hoje o backend só gera textPreview para MIME text/* ou application/json (veja extractTextPreview em server/catalog-file-storage.ts). PDFs/DOCX entram, mas ficam sem preview → sem embedding.

## Task Snapshot
- **Primary goal:** Implement backend parsing so catalog uploads (PDF, DOCX, RTF, ODT, CSV, etc.) generate `textPreview` reliably for embeddings and UI preview, not only text/* or JSON.
- **Success signal:** Uploading supported binary/text documents stores a trimmed `textPreview` in the database, surfaces in the catalog UI, and feeds embeddings/jobs without errors or timeouts.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)
  - [Architecture Notes](../docs/architecture.md) for backend/service boundaries
  - [Data Flow & Integrations](../docs/data-flow.md) for catalog upload + embedding lifecycle
  - [Testing Strategy](../docs/testing-strategy.md) for validation approach
  - [Security & Compliance Notes](../docs/security.md) for file parsing and secret handling

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que a nova pipeline de parsing siga padrões do backend e não quebre uploads existentes. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Caçar falhas de parsing/encoding em PDFs e DOCX e mitigar crashes de biblioteca. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Liderar implementação dos parsers e integração com `extractTextPreview`. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Isolar parsing em utilitário reutilizável/testável e remover duplicação. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Cobrir parsing com fixtures (PDF, DOCX, CSV) e garantir truncamento/sanitização. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar guias com tipos suportados, limites e fluxo de fallback. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Avaliar impacto de parsing em CPU/memória e propor limites ou streaming. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisar bibliotecas e sanitização para evitar RCE e exposição de dados. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Definir arquitetura de parsing (sync/async), fila ou inline, e integração com storage. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Confirmar que previews renderizam corretamente e UX lida com ausência de preview. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Decidir entre processamento inline vs. worker, e se há necessidade de reprocessar arquivos antigos. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Ajustar build CI (dependências nativas de parsing) e alertas de tempo de execução. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Avaliar impacto de armazenar previews maiores no Postgres e possíveis índices/quotas. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Baixo envolvimento; validar apenas se previews forem consumidos em clientes móveis futuros. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| Parsing libs falham com arquivos grandes/escaneados | Medium | High | Definir limites (p.ex., 10MB), timeout e fallback para ausência de preview | Backend Specialist |
| Dependências nativas ou pesadas quebram build/CI | Medium | Medium | Preferir libs puras em JS (pdf-parse, mammoth); validar no CI antes do merge | Devops Specialist |
| Possível exposição de dados sensíveis em previews | Low | High | Sanitizar saída, truncar para 2k chars, revisar com Security Auditor | Security Auditor |
| Performance degrada em uploads concorrentes | Medium | Medium | Medir tempo de parsing, considerar job assíncrono ou fila se necessário | Performance Optimizer |

### Dependencies
- **Internal:** Coordenação com time de embeddings para garantir consumo de `textPreview`; revisar limites de upload em `server/catalog-file-storage.ts` e `server/storage.ts`.
- **External:** Possível adoção de libs de parsing (pdf-parse, mammoth, csv-parse). Sem dependência externa se não houver OCR.
- **Technical:** Node toolchain compatível com novas libs; armazenamento em Postgres suportando tamanho de preview; acesso aos blobs para retrigger/reprocessamento.

### Assumptions
- Arquivos enviados seguem MIME listada em `allowedCatalogFileMimeTypes` e contêm texto extraível (não OCR). Se vierem imagens/scan, precisaremos de pipeline OCR futuro.
- Truncamento para ~2000 caracteres é suficiente para embeddings/preview; se não for, avaliar aumento com salvaguardas.
- Parsing pode ocorrer inline na requisição; se o tempo exceder SLAs, considerar worker/async job.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1 person-day | 2-3 days | 1-2 people |
| Phase 2 - Implementation | 4 person-days | 1 week | 2-3 people |
| Phase 3 - Validation | 2 person-days | 3-4 days | 1-2 people |
| **Total** | **7 person-days** | **~2 weeks** | **-** |

### Required Skills
- Node/TypeScript backend, Vite/Express stack
- Experiência com parsing de documentos (PDF, DOCX, CSV) e gestão de buffers
- Conhecimento de segurança para tratar inputs não confiáveis e sanitização de texto
- Opcional: familiaridade com filas/jobs se parsing assíncrono for necessário

### Resource Availability
- **Available:** Backend Specialist + Feature Developer para implementação; Test Writer para fixtures; Code Reviewer sob demanda.
- **Blocked:** Nenhum bloqueio conhecido; confirmar se há Janela de deploy.
- **Escalation:** Architect Specialist para decisões de arquitetura ou se parsing impactar SLAs.

## Working Phases
### Phase 1 — Discovery & Alignment
**Owner:** Backend Specialist
**Deliverables:** Mapa do fluxo atual de upload/preview, shortlist de libs de parsing (prós/contras), decisão de processamento inline vs. assíncrono.
**Evidence Expectations:** Notas técnicas sobre opções de libs e riscos, checklist de MIME/limites, decisão registrada.

**Steps**
1. Ler `server/catalog-file-storage.ts` e `server/storage.ts` para mapear onde o preview é gerado e consumido; validar limites (`BLOB_MAX_FILE_SIZE_BYTES`).
2. Avaliar bibliotecas de parsing (pdf-parse, mammoth, csv-parse) e verificar compatibilidade com ambiente atual; registrar perguntas abertas (ex.: precisamos backfill de arquivos já enviados?).

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Owner:** Feature Developer (par) com Refactoring Specialist
**Deliverables:** Função de parsing reutilizável, integração com `extractTextPreview` ou substituição, atualizações de limites/MIME, logs mínimos para troubleshooting.
**Evidence Expectations:** PR com código e testes, exemplos de preview gerado para PDF/DOCX/CSV, captura de métricas de tempo de parsing.

**Steps**
1. Implementar utilitário de parsing por MIME (PDF, DOCX, RTF/ODT, CSV) com truncamento e sanitização; ajustar `extractTextPreview`/pipeline para usar novo utilitário.
2. Atualizar rotas de upload para salvar preview, garantir fallbacks (sem preview → ainda salva arquivo) e adicionar métricas/logs leves. Referenciar Architecture, Data Flow e Security docs para alinhamento.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Owner:** Test Writer, com Documentation Writer
**Deliverables:** Testes automatizados cobrindo parsing/truncamento e docs atualizados sobre tipos suportados e limites; plano de backfill se necessário.
**Evidence Expectations:** Saída de testes (p.ex., `npm run check` + testes de parsing), screenshots/JSON de previews, anotações de segurança.

**Steps**
1. Criar fixtures pequenas de PDF/DOCX/CSV e testes que validem preview correto, truncamento e comportamento em falhas (retorna undefined/erro tratado). Executar conforme Testing Strategy.
2. Atualizar docs em Architecture/Data Flow/Security para refletir parsing; registrar evidências e, se aplicável, roteiro de reprocessamento de anexos existentes.

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
- Action: Reverter commits que adicionam parsing e dependências; restaurar `extractTextPreview` antigo se necessário.
- Data Impact: Nenhum impacto estrutural; novos previews podem ser descartados, dados de blob permanecem.
- Estimated Time: 1-2 hours

#### Phase 3 Rollback
- Action: Rollback da release, remover testes/doc de parsing; se backfill rodou, avaliar limpeza opcional.
- Data Impact: Previews existentes continuam no DB; sem alterações em blobs.
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
- Artefatos: PR com diffs, resultados de testes de parsing, exemplos de previews gerados (sem dados sensíveis), decisões de biblioteca/timeout, notas de segurança.
- Follow-up: Decidir se há pipeline para reprocessar arquivos antigos; monitorar métricas de tempo/erro de parsing após deploy; abrir issue se OCR for requisitado.

<!-- agent-update:end -->
