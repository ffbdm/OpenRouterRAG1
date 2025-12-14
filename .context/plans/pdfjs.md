---
id: plan-pdfjs
ai_update_goal: "Define the stages, owners, and evidence required to complete Pdfjs."
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

<!-- agent-update:start:plan-pdfjs -->
# Pdfjs Plan

> Hoje você usa `pdf-parse` (`PDFParse.getText()`), que é ótimo pra “texto corrido”, mas não preserva layout/posições — por isso tabela vira texto “quebrado”. Para melhorar extração de tabelas, a abordagem mais comum é: PDF.js (`pdfjs-dist`) + heurísticas de layout (Node/TS): pegar itens de texto com coordenadas (x/y), agrupar por linha (y) e coluna (clusters de x) e reconstruir em Markdown (idealmente em formato de tabela `| col | col |`).

## Task Snapshot
- **Primary goal:** Substituir (ou complementar) a extração de texto de PDFs no backend por uma extração baseada em PDF.js que preserve “estrutura de tabela”, gravando um `textPreview` mais útil para embeddings e para buscas (híbridas/lexicais) do catálogo.
- **Success signal:** Ao enviar PDFs com tabelas (fichas técnicas, composição, dose etc.), o `catalog_files.textPreview` passa a conter conteúdo legível (linhas e/ou tabelas em Markdown), melhorando recall de buscas por termos presentes em células (ex.: “composição”, “ingrediente ativo”, “dose”) e reduzindo “trechos embaralhados”; fallback para `pdf-parse` continua funcionando quando a heurística falhar.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)
  - [Data Flow](../docs/data-flow.md) (upload de anexos + embeddings)
  - `server/catalog-file-preview.ts` (parsing atual de PDF via `pdf-parse`)
  - `server/storage.ts` (`refreshFileEmbedding` usa `textPreview`)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Garantir que a mudança de parsing não quebre uploads, mantenha TS estrito e que os defaults/fallbacks estejam claros. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Investigar PDFs “difíceis” (multi-coluna, fontes estranhas) e corrigir edge cases na heurística (linhas/colunas). | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implementar a extração com `pdfjs-dist`, reconstrução de linhas/tabelas e integração com `extractTextPreview`. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Isolar parsing de PDF em módulo reutilizável e manter `server/catalog-file-preview.ts` coeso. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Criar testes determinísticos (fixtures) para garantir que tabelas e texto saem com estrutura mínima e truncamento. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Atualizar docs do fluxo de anexos/embeddings e registrar limitações (sem OCR, limites de páginas). | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Medir custo (CPU/mem/tempo) do `pdfjs-dist` e definir limites (páginas, chars, timeout) e logs. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Revisar superfície de ataque de parsing de PDF, timeouts e evitar logging de conteúdo sensível. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Definir contrato/config: engine, fallback, limiares de agrupamento e onde armazenar (somente `textPreview`). | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Verificar se a UI de anexos continua ok e, opcionalmente, planejar futuro “preview” em modal se fizer sentido. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Validar que a mudança melhora RAG sem comprometer latência e sem exigir mudanças de schema. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Garantir que `pdfjs-dist` funciona no build/prod (ESM, bundling externo) e que deploy não explode em bundle/cold start. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Avaliar se precisamos backfill de previews/embeddings e propor um script seguro (sem migration). | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Sem ação imediata; apenas garantir que o contrato de API de anexos não muda para clientes futuros. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| `pdfjs-dist` aumentar custo (CPU/mem) e/ou quebrar build ESM | Medium | High | POC isolada, manter `pdf-parse` como fallback por env, testar `npm run build` e `npm run start` cedo | Devops Specialist + Backend Specialist |
| Heurística gerar tabela errada (multi-coluna, células mescladas) | High | Medium | Detecção conservadora: só “promove” para tabela quando há evidências fortes; caso contrário, retorna linhas simples; incluir fixtures com exemplos reais | Feature Developer + Bug Fixer |
| PDFs escaneados (sem camada de texto) continuarem sem conteúdo útil | High | Low | Deixar explícito “sem OCR”; manter preview vazio/limitado sem travar upload; documentar follow-up para OCR se necessário | Documentation Writer |
| Reprocessamento de arquivos antigos gerar carga e/ou embeddings “desalinhados” | Medium | Medium | Script de backfill com limites (por item/página), execução manual e feature flag; logs e dry-run | Database Specialist |

### Dependencies
- **Internal:** pipeline de upload em `server/catalog-routes.ts`, parser central em `server/catalog-file-preview.ts`, embeddings em `server/storage.ts` (usa `textPreview`), chunking em `server/text-chunking.ts`.
- **External:** `pdfjs-dist` (PDF.js), Node runtime compatível com ESM, e PDFs reais de referência (com tabela) para validar.
- **Technical:** manter `esbuild` com `--packages=external` (já está), garantir import ESM do PDF.js no Node (`pdfjs-dist/legacy/build/pdf.mjs` ou equivalente), definir limites por env (páginas/chars/timeout).

### Assumptions
- A maioria dos PDFs relevantes tem camada de texto (não é imagem escaneada). Se não tiver, o preview continua ruim e a solução vira OCR (fora do escopo).
- Guardar Markdown “misturado” no `catalog_files.textPreview` é aceitável (o campo já é `text` e é consumido como string para embeddings/snippets). Se isso conflitar com UI futura, considerar coluna nova (`text_preview_markdown`) em um passo posterior.
- O limite atual de upload (~10MB) e o truncamento do preview evitam explosão de CPU/memória. Se não evitarem, vamos reduzir páginas processadas e/ou criar timeout.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 0.5–1.0 pessoa-dia | 1-2 dias | 1 |
| Phase 2 - Implementation | 2–4 pessoa-dias | 3-7 dias | 1-2 |
| Phase 3 - Validation | 1–2 pessoa-dias | 2-4 dias | 1-2 |
| **Total** | **3.5–7 pessoa-dias** | **1–2 semanas** | **-** |

### Required Skills
- TypeScript/Node ESM, `pdfjs-dist` (PDF.js), heurísticas simples de layout (coordenadas, clustering), noções de performance.
- Conhecimento do fluxo de anexos/embeddings (`server/catalog-file-preview.ts`, `server/storage.ts`) e como o RAG usa snippets.
- Skill gaps: heurística de tabela (alinhamento de colunas) pode exigir iteração com PDFs reais.

### Resource Availability
- **Available:** Fab (backend) para POC + implementação; 1 revisor (Code Reviewer) para revisar PR e riscos.
- **Blocked:** se faltarem PDFs reais com tabelas (amostras), o plano perde validação; pedir ao time/cliente 2-3 arquivos “problemáticos”.
- **Escalation:** Architect Specialist para decisões de formato (Markdown vs texto) e Devops Specialist para questões de build/deploy.

## Working Phases
### Phase 1 — Discovery & Alignment
**Owner:** Backend Specialist
**Deliverables:** decisão de engine/config (pdfjs, fallback), POC comprovando extração por coordenadas, e “criterios de tabela” definidos.
**Evidence Expectations:** snippet de saída (antes/depois) de um PDF real com tabela, e lista de limites/env vars planejadas.

**Steps**
1. Mapear o fluxo atual: upload (`server/catalog-routes.ts`) → `extractTextPreview` (`server/catalog-file-preview.ts`) → `catalog_files.textPreview` → embeddings (`server/storage.ts#refreshFileEmbedding`).
2. Criar POC local (script em `scripts/` ou sandbox) lendo um PDF real e imprimindo: itens `(str, x, y)`, agrupamento em linhas, e um “esboço” de tabela (Markdown) com colunas detectadas.
3. Definir perguntas abertas e critérios:
   - O preview deve priorizar tabelas (Markdown) ou texto corrido?
   - Limites: quantas páginas processar? (ex.: primeiras N páginas ou até X chars)
   - Feature flag: `PDF_PREVIEW_ENGINE=pdf-parse|pdfjs|pdfjs+fallback`?

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Owner:** Feature Developer (par com Refactoring Specialist)
**Deliverables:** parser PDF.js integrado ao backend, heurística de tabela conservadora, fallback e limites configuráveis.
**Evidence Expectations:** PR com código + logs mínimos (sem conteúdo sensível), e demonstração em upload de PDF real.

**Steps**
1. Adicionar `pdfjs-dist` e implementar `extractPdfPreviewWithPdfJs(buffer, options)` em módulo dedicado (ex.: `server/pdfjs-preview.ts`) com:
   - Leitura por página (`getTextContent`) e itens com coordenadas.
   - Agrupamento por linha (tolerância de Y) e por coluna (clusters de X).
   - Detecção de “blocos tabulares” e renderização em Markdown.
   - Limites: `PDF_PREVIEW_MAX_PAGES`, `PDF_PREVIEW_MAX_CHARS`, `PDF_PREVIEW_TIMEOUT_MS`.
2. Integrar em `server/catalog-file-preview.ts` com fallback para `pdf-parse`:
   - Default sugerido: `pdfjs+fallback` (tenta PDF.js, se falhar usa `pdf-parse`).
   - Sanitização que preserve quebras de linha necessárias para Markdown (sem “matar” pipes/linhas).
3. Preparar reprocessamento:
   - Script de backfill (opcional) para re-gerar `textPreview` e re-gerar embeddings de arquivos PDF existentes, em lotes e com dry-run.

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Owner:** Test Writer + Documentation Writer
**Deliverables:** testes/QA, docs atualizadas, e checklist de deploy/rollback (feature flag).
**Evidence Expectations:** `npm run check`, `npm run build`, `npm run test` e evidência manual (upload PDF + DB) com logs.

**Steps**
1. Adicionar testes determinísticos:
   - Fixtures de PDF pequenas com tabela (idealmente 1–2 páginas) e asserts de que a saída contém estrutura esperada (`|` + headers) e termos em células.
   - Testes de fallback (PDF.js falha → usa `pdf-parse`) e truncamento.
2. Validar manualmente:
   - `npm run dev` → upload de PDF com tabela → conferir `catalog_files.textPreview` (via DB/console) e geração de embeddings (logs `[DB]`).
   - Rodar script de backfill em dev/staging com limites pequenos.
3. Atualizar documentação:
   - `.context/docs/data-flow.md` (mencionar engine/feature flag e limites).
   - `.context/docs/security.md` (timeout/limites e “sem OCR”).
   - `.context/docs/testing-strategy.md` (comandos e fixtures).

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
- Action: Desativar por env (`PDF_PREVIEW_ENGINE=pdf-parse`) e/ou reverter commits que adicionam `pdfjs-dist` e a heurística; manter o parsing atual.
- Data Impact: Nenhuma migração; `textPreview` existente pode conter Markdown, mas é apenas texto. Opcional: reprocessar PDFs para “texto corrido” via script.
- Estimated Time: 30-90 minutes

#### Phase 3 Rollback
- Action: Rollback de deploy para versão anterior e/ou feature flag para `pdf-parse`; interromper backfill se estiver rodando.
- Data Impact: Embeddings gerados com preview novo permanecem, mas podem ser regenerados depois; blobs e metadados não mudam.
- Estimated Time: 30-60 minutes

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
- Artefatos: PR(s) com implementação + testes, PDFs de referência (sem dados sensíveis), logs de tempo de parsing (p95) e exemplos de `textPreview` antes/depois.
- Follow-up:
  - Monitorar custo de parsing em produção (CPU/mem/latência do upload) por 1 semana (Performance Optimizer + Devops Specialist).
  - Se houver necessidade de OCR (PDF escaneado), abrir plano separado (Architect Specialist).
  - Ajustar heurísticas/limiares com base nos PDFs reais mais frequentes (Bug Fixer + Feature Developer).

<!-- agent-update:end -->
