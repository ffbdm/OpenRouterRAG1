```yaml
---
id: plan-rag-context-catalog
ai_update_goal: "Define the stages, owners, and evidence required to complete Rag Context Catalog."
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
```

<!-- agent-update:start:plan-rag-context-catalog -->
# Rag Context Catalog Plan

> Adicionar no catalogo um local para ter arquivos de texto (pdf, txt, doc, docx) e outros. Adicionar no sistema o storage do vercel chamado agroremoto-blob que ira conter os arquivos dos itens do catalogo. fazer uma separacao por itens dentro do storage.

## Task Snapshot
- **Primary goal:** Enhance the RAG context catalog to support uploading and storing text-based files (PDF, TXT, DOC, DOCX, and others) associated with catalog items, using Vercel Blob storage "agroremoto-blob" with paths organized as `{itemId}/{filename}` for separation.
- **Success signal:** Users can upload files via the catalog UI, files persist in the blob store under item-specific paths, metadata is stored in the DB, files are retrievable for RAG context, with >80% test coverage and updated documentation.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)
  - `server/routes.ts`, `server/storage.ts` (if exists), `shared/schema.ts`, `drizzle.config.ts`

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Provide feedback on all PRs for upload APIs, UI, and schema changes | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Address bugs in upload flows, blob handling, or DB integrations | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Lead core implementation of file upload and retrieval logic | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Refactor existing storage or catalog code to integrate cleanly with Vercel Blob | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Develop unit, integration, and E2E tests for upload endpoints and client handling | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Update docs with file upload workflows, schema changes, and architecture notes | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Optimize upload handling for large files and high concurrency | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Secure endpoints against injection, oversized files, and unauthorized access | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Implement server-side Vercel Blob integration, API routes, and metadata storage | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Build file picker, progress indicators, and upload UI in catalog pages | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Design storage structure, DB relations, and RAG integration patterns | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Configure Vercel Blob access, deployment env vars, and CI/CD for new package | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Extend schema for file metadata (e.g., relations to catalog items) and migrations | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Standby for mobile upload adaptations if client expands to mobile | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| Vercel Blob "agroremoto-blob" not configured or permissions issues | High | High | Devops Specialist verifies store setup and Vercel integration early | Devops Specialist |
| Security vulnerabilities in file uploads (e.g., path traversal) | Medium | High | Security Auditor reviews endpoints in Phase 3 with strict validation | Security Auditor |
| Poor performance with large files or RAG extraction | Medium | Medium | Performance Optimizer prototypes large file uploads in Phase 2 | Performance Optimizer |

### Dependencies
- **Internal:** Stable catalog item CRUD APIs and schema in `shared/schema.ts`
- **External:** Vercel Blob store "agroremoto-blob" created and linked to project
- **Technical:** `@vercel/blob` package installable, Drizzle migrations supported

### Assumptions
- Blob store "agroremoto-blob" exists with public read/write via Vercel SDK
- Files ≤10MB, text/extractable formats only; no virus scanning required initially
- If false: Devops Specialist creates store; fallback to temp local storage and escalate

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1 person-day | 2 days | 1-2 people |
| Phase 2 - Implementation | 5 person-days | 1 week | 2-3 people |
| Phase 3 - Validation | 2 person-days | 3 days | 1-2 people |
| **Total** | **8 person-days** | **~2 weeks** | **-** |

### Required Skills
- Vercel Blob SDK, Next.js API routes, Drizzle schema/migrations, React file APIs, Vitest/Jest
- Skill gaps: Vercel-specific experience (mitigate with official docs/quickstart)

### Resource Availability
- **Available:** All listed agents via AI playbooks
- **Blocked:** None identified
- **Escalation:** Architect Specialist if blob store setup blocks progress

## Working Phases
### Phase 1 — Discovery & Alignment
**Owner:** Architect Specialist

**Steps**
1. Architect Specialist: Review `docs/architecture.md` and `docs/data-flow.md`; design blob paths (`{itemId}/{filename}`), DB relations (e.g., `files` table with `catalogItemId`), RAG retrieval flow. Deliverable: ADR note in `plans/` or commit.
2. Backend Specialist + Database Specialist: Propose schema extensions in `shared/schema.ts`. Consult `docs/glossary.md` for terms like "catalog-file".
3. Devops Specialist: Confirm "agroremoto-blob" setup and env vars (e.g., `BLOB_READ_WRITE_TOKEN`).
4. Capture open questions: Max file size? MIME types? Auth for uploads? Escalate to human if needed.

**Status 2025-11-29:** Registramos descobertas iniciais em [rag-context-catalog-discovery.md](./rag-context-catalog-discovery.md) cobrindo design de paths (`catalog-files/{itemId}/{slug}-{uuid}{ext}`), tabela `catalog_files` (metadados + preview opcional), rotas REST de upload/list/delete, dependências (`@vercel/blob`, `multer`), envs (`BLOB_READ_WRITE_TOKEN`, `BLOB_PUBLIC_BASE_URL`) e dúvidas em aberto sobre auth, limites e ingestão de texto para RAG.

**Status 2025-11-29 12:08 BRT:** Revisamos o estado atual do repo. Não há UI de catálogo no cliente (`client/src/pages` só contém chat/not-found) nem rotas de upload/storage no servidor (`server/storage.ts` só cobre usuários/FAQ/catalog search). Nenhuma referência a Vercel Blob ou envs `BLOB_*` foi encontrada. Próximo passo: confirmar requisitos de UI (página de item) e provisionamento do bucket antes de iniciar Phase 2.

**Deliverables:** Design ADR, schema proposal PR, blob config confirmation.
**Evidence:** Committed design notes, screenshot of blob store.

**Commit Checkpoint**
- `git commit -m "chore(plan): complete phase 1 discovery"`

### Phase 2 — Implementation & Iteration
**Owner:** Backend Specialist (lead), Feature Developer

**Steps**
1. Devops Specialist: Add `@vercel/blob` to `package.json`, update `vercel.json`; test locally per `docs/tooling.md`.
2. Database Specialist: Implement schema changes and migration via `drizzle.config.ts`.
3. Backend Specialist: Add `/api/upload/[itemId]` route in `server/routes.ts` using `putBlob`; store metadata. Reference `server/storage.ts` if exists.
4. Frontend Specialist: Integrate file input/upload progress in client catalog UI (e.g., `/catalog/[id]` page).
5. Refactoring Specialist: Clean integrations; daily Code Reviewer check-ins on WIP PRs.

**Status 2025-11-29 13:49 BRT:** Implementado armazenamento de anexos de catálogo usando Vercel Blob. Novas dependências `@vercel/blob`, `multer` e `@types/multer`. Schema estendido com tabela `catalog_files` em `shared/schema.ts` (FK para `catalog_items`, metadados, preview opcional). Backend: `server/catalog-file-storage.ts` valida MIME (pdf/txt/doc/docx/md/json/csv/rtf/odt), limite 10MB configurável (`BLOB_MAX_FILE_SIZE_BYTES`), gera paths `catalog-files/{itemId}/slug-uuid.ext` e envia via Blob com `BLOB_READ_WRITE_TOKEN`/`BLOB_PUBLIC_BASE_URL`; rotas em `server/catalog-routes.ts` para `POST /api/catalog/:id/files`, `GET /api/catalog/:id/files` e `DELETE /api/catalog/files/:fileId` + Drizzle em `storage.ts`. Frontend: `client/src/pages/catalog.tsx` ganhou gerenciador de arquivos (upload/list/delete, toasts, preview) por item. Testes adicionados em `tests/catalog-file-storage.test.ts`. Docs atualizadas em `.context/docs/data-flow.md` e `.context/docs/security.md`. Pendentes: rodar `npm run db:push` para criar tabela em ambientes, provisionar/verificar bucket `agroremoto-blob` e tokens `BLOB_READ_WRITE_TOKEN/BLOB_PUBLIC_BASE_URL`, validar limites/mimes com stakeholders e adicionar auditoria de auth/rate-limit antes de produção.

**Deliverables:** Working upload API/UI, migration script, initial tests.
**Evidence:** Local demo video, blob files created, DB rows inserted.

**Commit Checkpoint**
- `git commit -m "chore(plan): complete phase 2 implementation"`

### Phase 3 — Validation & Handoff
**Owner:** Test Writer (lead), Code Reviewer

**Steps**
1. Test Writer: Add unit/integration tests (upload success/error, retrieval); E2E via Playwright/Cypress per `docs/testing-strategy.md`.
2. Security Auditor: Audit for sanitization, rate limits, auth per `docs/security.md`.
3. Performance Optimizer: Test 10MB uploads, optimize streams.
4. Documentation Writer: Update `docs/architecture.md`, `docs/data-flow.md`, `docs/glossary.md` with agent-update markers.
5. Bug Fixer + Code Reviewer: Fix issues, merge PRs; deploy to staging.

**Deliverables:** Merged PRs, test reports, updated docs.
**Evidence:** Coverage report (>80%), staging upload screenshots, PR links.

**Commit Checkpoint**
- `git commit -m "chore(plan): complete phase 3 validation"`

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
- Action: `git revert` implementation commits, run DB migration down, manually delete blobs prefixed `{itemId}/`
- Data Impact: File metadata deleted; blobs manually removed (no auto-loss)
- Estimated Time: 2-4 hours

#### Phase 3 Rollback
- Action: Revert deployment via Vercel dashboard, run full DB rollback
- Data Impact: Sync deletions of metadata/blobs; no persistent loss
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
- Artifacts: PR links (e.g., #12 schema, #13 backend, #14 frontend), test coverage report, staging deploy logs, blob store screenshots, updated docs with agent-update markers.
- Follow-up: Backend Specialist monitors prod uploads for 1 week; add to backlog: virus scanning, analytics on uploads (Owner: Architect Specialist).
- 2025-11-29: Execução desta sessão pausada na transição para Phase 2. Pendências: provisionar Vercel Blob `agroremoto-blob` + tokens `BLOB_*`, definir página/UI de item de catálogo para encaixar o upload, validar limites de tamanho/MIME.

<!-- agent-update:end -->
