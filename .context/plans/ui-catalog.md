---
id: plan-ui-catalog
ai_update_goal: "Define the stages, owners, and evidence required to complete Ui Catalog."
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

<!-- agent-update:start:plan-ui-catalog -->
# Ui Catalog Plan

> Criar na UI um acesso para o catalogo. onde possa ter CRUD.

## Task Snapshot
- **Primary goal:** Ship a UI entry point for the catalog that lets users list, create, edit, and delete items with clear Portuguese copy and confirmations.
- **Success signal:** Catalog CRUD flows are reachable from the app shell, persist changes to the catalog data source, pass type checks, and include basic tests plus screenshots of list/create/edit/delete in the PR.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Project Overview](../docs/project-overview.md)
  - [Architecture Notes](../docs/architecture.md)
  - [Development Workflow](../docs/development-workflow.md)
  - [Testing Strategy](../docs/testing-strategy.md)
  - [Glossary & Domain Concepts](../docs/glossary.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Enforce UI patterns, Tailwind conventions, and regression safety before merging. | [Code Reviewer](../agents/code-reviewer.md) | Review code changes for quality, style, and best practices |
| Bug Fixer | Triage catalog CRUD defects surfaced during QA or after deploy. | [Bug Fixer](../agents/bug-fixer.md) | Analyze bug reports and error messages |
| Feature Developer | Implement catalog list/detail/create/edit/delete flows plus navigation entry point. | [Feature Developer](../agents/feature-developer.md) | Implement new features according to specifications |
| Refactoring Specialist | Keep shared hooks/components clean while adding CRUD plumbing. | [Refactoring Specialist](../agents/refactoring-specialist.md) | Identify code smells and improvement opportunities |
| Test Writer | Add component/API interaction tests for catalog actions and error handling. | [Test Writer](../agents/test-writer.md) | Write comprehensive unit and integration tests |
| Documentation Writer | Update UX notes or README snippets describing catalog access and usage. | [Documentation Writer](../agents/documentation-writer.md) | Create clear, comprehensive documentation |
| Performance Optimizer | Watch render/query patterns to avoid slow catalog lists on large datasets. | [Performance Optimizer](../agents/performance-optimizer.md) | Identify performance bottlenecks |
| Security Auditor | Ensure destructive actions have confirmation, auth, and no secret leakage. | [Security Auditor](../agents/security-auditor.md) | Identify security vulnerabilities |
| Backend Specialist | Confirm API endpoints and storage contract support CRUD safely. | [Backend Specialist](../agents/backend-specialist.md) | Design and implement server-side architecture |
| Frontend Specialist | Shape interaction design, empty states, and accessibility for catalog UI. | [Frontend Specialist](../agents/frontend-specialist.md) | Design and implement user interfaces |
| Architect Specialist | Validate state management and API layering align with existing patterns. | [Architect Specialist](../agents/architect-specialist.md) | Design overall system architecture and patterns |
| Devops Specialist | Keep build/start scripts and env wiring intact for new catalog flows. | [Devops Specialist](../agents/devops-specialist.md) | Design and maintain CI/CD pipelines |
| Database Specialist | Verify catalog schema usage and migrations if new fields appear. | [Database Specialist](../agents/database-specialist.md) | Design and optimize database schemas |
| Mobile Specialist | Spot responsive issues so catalog UI works on small viewports. | [Mobile Specialist](../agents/mobile-specialist.md) | Develop native and cross-platform mobile applications |

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
| Catalog API contract incomplete for CRUD (list/create/update/delete). | Medium | High | Align with backend/storage owners early; add stub handlers if needed. | Backend Specialist |
| Destructive actions without confirmation lead to data loss. | Medium | High | Require confirmation dialogs and optimistic rollback; add tests. | Frontend Specialist |
| UI performance degrades with large catalog lists. | Low | Medium | Use pagination or virtualization; reuse query caching. | Performance Optimizer |
| Localized copy/instructions incomplete. | Medium | Medium | Review against glossary and design guidelines; gather approvals. | Documentation Writer |

### Dependencies
- **Internal:** Express catalog routes/storage layer, shared Drizzle schema, React Query client, design guidelines.
- **External:** Neon/Postgres availability with catalog data; OpenRouter not directly required but chat UI should remain unaffected.
- **Technical:** Stable TypeScript types for catalog items; Vite/esbuild build pipeline; env vars `DATABASE_URL` present.

### Assumptions
- Catalog schema in `shared/schema.ts` remains the source of truth; API will expose CRUD endpoints matching it.
- Navigation allows adding a catalog entry point without major IA changes; if not, revisit design with stakeholders.
- No new auth model is introduced; if permissions are required, scope plan to add guards and role checks.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 1 person-day | 1-2 days | 1-2 people |
| Phase 2 - Implementation | 4-5 person-days | 1 week | 2-3 people |
| Phase 3 - Validation | 2 person-days | 3-4 days | 1-2 people |
| **Total** | **7-8 person-days** | **~2 weeks elapsed** | **-** |

### Required Skills
- React + TypeScript with React Query and shadcn/ui; Express + Drizzle familiarity; Tailwind styling; UX copy in Portuguese; Postgres basics for catalog data.
- Fill gaps via pairing with backend/front-end specialists and reviewing design guidelines.

### Resource Availability
- **Available:** Frontend + backend contributors currently rotating on catalog work; QA bandwidth for validation.
- **Blocked:** None known; confirm database access early.
- **Escalation:** Tech lead/maintainer for catalog (request in standup) if blockers arise.

## Working Phases
### Phase 1 — Discovery & Alignment
**Steps**
1. Audit existing catalog data model, API routes, and UI entry points; confirm CRUD requirements and permissions (Owner: Backend Specialist).
2. Identify UX flows, empty states, and confirmation patterns using glossary/design guidelines; list open questions (Owner: Frontend Specialist).

**Commit Checkpoint**
- After completing this phase, capture the agreed context and create a commit (for example, `git commit -m "chore(plan): complete phase 1 discovery"`).

### Phase 2 — Implementation & Iteration
**Steps**
1. Implement navigation entry to catalog view plus list/detail + modal/page for create/edit with form validation and delete confirmations (pair FE/BE as needed).
2. Wire API mutations/queries, handle loading/error states, and add tests aligned with [Testing Strategy](../docs/testing-strategy.md) and [Development Workflow](../docs/development-workflow.md).

**Commit Checkpoint**
- Summarize progress, update cross-links, and create a commit documenting the outcomes of this phase (for example, `git commit -m "chore(plan): complete phase 2 implementation"`).

### Phase 3 — Validation & Handoff
**Steps**
1. Run TypeScript checks, manual CRUD QA, and capture screenshots/GIFs; verify no regressions in chat flow.
2. Update docs (README/UX notes) with access instructions; collect evidence (test logs, screenshots) for maintainers.

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
- Action: Revert catalog UI/route commits; disable navigation entry; restore database to pre-change snapshot if mutations shipped.
- Data Impact: Possible loss of catalog edits during feature window; coordinate with DB backups.
- Estimated Time: 2-4 hours

#### Phase 3 Rollback
- Action: Roll back deployment to prior build, flush CDN if applicable, and re-enable previous catalog UI (if any).
- Data Impact: Align catalog rows to last known good snapshot; reconcile edits made post-release.
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
- Collect PR link, screenshots/GIFs of CRUD flows, TypeScript/check/test outputs, and any backend API contract notes.
- Follow-ups: confirm database backup schedule, plan pagination/filters for large catalogs, and schedule post-release monitoring owner.

<!-- agent-update:end -->
