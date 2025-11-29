```markdown
---
id: plan-rag-system-hybrid
ai_update_goal: "Define the stages, owners, and evidence required to complete Rag System Hybrid."
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

<!-- agent-update:start:plan-rag-system-hybrid -->
# Rag System Hybrid Plan

> Criar um sistema hibrido de rag, onde a llm irá utilizar tanto as call tools quanto o storage do catalogo. Para este rag da storage, criar um catalogo vetorizado onde a llm ira realizar suas buscas neste catalogo quando o usuario perguntar algo sobre agronomia de forma geral. 
> A ideia é o cliente encontrar um produto que precisa diante de uma dúvida que tenha, onde os catalogos possam ser úteis para ajuda-lo.

## Task Snapshot
- **Primary goal:** Implement a hybrid RAG system in `server/` that combines dynamic LLM tool calls with retrieval from a vectorized agronomy catalog stored in the database, enabling accurate responses to general agronomy queries without disrupting existing flows.
- **Success signal:** E2E tests pass for hybrid queries retrieving relevant vectors and invoking tools; new endpoints achieve <200ms latency; docs/data-flow.md and architecture.md updated with diagrams; CI/CD deploys successfully.
- **Key references:**
  - [Documentation Index](../docs/README.md)
  - [Agent Handbook](../agents/README.md)
  - [Plans Index](./README.md)

## Agent Lineup
| Agent | Role in this plan | Playbook | First responsibility focus |
| --- | --- | --- | --- |
| Code Reviewer | Review all PRs for RAG code to ensure quality, TS standards, and repo conventions | [Code Reviewer](../agents/code-reviewer.md) | Review initial architecture design doc |
| Bug Fixer | Triage and fix integration bugs in LLM chain or vector retrieval | [Bug Fixer](../agents/bug-fixer.md) | Analyze prototype error logs from Phase 1 |
| Feature Developer | Implement core hybrid logic integrating vector search with tool calls | [Feature Developer](../agents/feature-developer.md) | Prototype agronomy query detection in LLM prompts |
| Refactoring Specialist | Refactor `server/storage.ts` to support vector operations without breaking catalog | [Refactoring Specialist](../agents/refactoring-specialist.md) | Audit existing catalog schema and queries |
| Test Writer | Author unit/integration/E2E tests for vector indexing, search, and hybrid flows | [Test Writer](../agents/test-writer.md) | Write unit tests for embedding generation |
| Documentation Writer | Update data-flow.md, architecture.md, and glossary.md with RAG details | [Documentation Writer](../agents/documentation-writer.md) | Draft RAG overview in architecture.md |
| Performance Optimizer | Profile and tune vector search latency and embedding compute | [Performance Optimizer](../agents/performance-optimizer.md) | Baseline query performance pre/post changes |
| Security Auditor | Audit new endpoints and DB queries for injections, leaks in vector data | [Security Auditor](../agents/security-auditor.md) | Review schema migrations for sensitive fields |
| Backend Specialist | Build server routes/endpoints for vectorization, indexing, and hybrid retrieval | [Backend Specialist](../agents/backend-specialist.md) | Implement `/rag/search` endpoint |
| Frontend Specialist | Update client chat UI to display RAG-sourced responses if enriched | [Frontend Specialist](../agents/frontend-specialist.md) | Review API contract for client compatibility |
| Architect Specialist | Design system-wide hybrid RAG architecture and update diagrams | [Architect Specialist](../agents/architect-specialist.md) | Create updated data flow diagram |
| Devops Specialist | Extend CI/CD for migrations, tests, and Vercel deployment | [Devops Specialist](../agents/devops-specialist.md) | Add Drizzle migration to deploy script |
| Database Specialist | Extend schema.ts with vector columns/indexes using Drizzle/pgvector | [Database Specialist](../agents/database-specialist.md) | Propose schema PR with pgvector support |
| Mobile Specialist | Ensure API changes are backward-compatible for any future mobile client | [Mobile Specialist](../agents/mobile-specialist.md) | Validate API schema against mobile stubs |

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
| Breaking existing tool call flows during hybrid integration | Medium | High | Regression tests + staged rollout | Architect Specialist |
| Poor vector search recall/precision on agronomy data | High | Medium | Curate eval dataset + iterative tuning | Database Specialist |
| Embedding latency impacting response times | Medium | Medium | Caching + lightweight model selection | Performance Optimizer |

### Dependencies
- **Internal:** `server/storage.ts`, `server/routes.ts`, `shared/schema.ts`
- **External:** Embedding provider (e.g., OpenRouter/OpenAI API)
- **Technical:** PostgreSQL with pgvector extension; Drizzle migration support

### Assumptions
- Existing catalog schema can be extended with vector columns without full rewrite.
- Agronomy seed data will be provided (e.g., CSV/JSON import script).
- If assumptions prove false: Escalate to maintainers for new table design or data acquisition plan.

## Resource Estimation

### Time Allocation
| Phase | Estimated Effort | Calendar Time | Team Size |
| --- | --- | --- | --- |
| Phase 1 - Discovery | 2 person-days | 3-5 days | 1-2 people |
| Phase 2 - Implementation | 8 person-days | 1-2 weeks | 2-3 people |
| Phase 3 - Validation | 3 person-days | 3-5 days | 1-2 people |
| **Total** | **13 person-days** | **~3 weeks** | **-** |

### Required Skills
- TypeScript/Node.js backend development
- Drizzle ORM, PostgreSQL/pgvector for vectors
- Embeddings generation and semantic search
- LLM integration/prompting basics
- Identify skill gaps and training needs: Pair ML-naive devs with Backend Specialist

### Resource Availability
- **Available:** Backend Specialist, Database Specialist, Architect Specialist (full availability next sprint)
- **Blocked:** None identified
- **Escalation:** Architect Specialist if additional headcount needed

## Working Phases
### Phase 1 — Discovery & Alignment
**Overall Owner:** Architect Specialist

**Steps**
1. Architect Specialist: Review `docs/architecture.md` and `docs/data-flow.md`; propose hybrid design doc with diagrams.
2. Database Specialist: Audit `shared/schema.ts`; recommend vector fields/indexes and embedding model.
3. Backend Specialist: Prototype basic vector search PoC referencing `docs/tooling.md` for setup.

**Deliverables**
- Design doc (new file in `plans/` or PR to `docs/architecture.md`)
- Schema proposal PR
- List of open questions (e.g., data sources, eval metrics)

**Evidence Expectations**
- Design doc committed
- PoC logs showing sample retrieval

**Commit Checkpoint**
- `git commit -m "chore(plan): complete phase 1 discovery & design doc"`

### Phase 2 — Implementation & Iteration
**Overall Owner:** Backend Specialist

**Steps**
1. Database Specialist: Implement schema changes/migrations in `shared/schema.ts` and Drizzle config.
2. Backend Specialist: Add embedding/vector search endpoints in `server/routes.ts`/`storage.ts`.
3. Feature Developer: Integrate hybrid logic into LLM chain (detect agronomy -> retrieve -> augment tools).
4. Refactoring Specialist: Clean up storage code smells exposed by vectors.
5. Performance Optimizer: Tune indexes/caches, reference `docs/development-workflow.md` for profiling.

**Deliverables**
- Merged PRs for schema, endpoints, LLM integration
- Seed script for agronomy vectors
- Daily PR reviews by Code Reviewer

**Evidence Expectations**
- Local tests pass for vector ops
- Perf benchmarks (<200ms search)

**Commit Checkpoint**
- `git commit -m "chore(plan): complete phase 2 implementation & integrations"`

### Phase 3 — Validation & Handoff
**Overall Owner:** Test Writer

**Steps**
1. Test Writer: Add unit/integration/E2E tests for hybrid flows, update `docs/testing-strategy.md`.
2. Security Auditor: Scan new code/endpoints per `docs/security.md`.
3. Documentation Writer: Update `docs/data-flow.md`, `glossary.md` (add RAG terms), `docs/architecture.md`.
4. Devops Specialist: Extend CI/CD in `vercel.json`/scripts for migrations/tests.
5. Frontend Specialist & Mobile Specialist: Validate client/API compatibility.

**Deliverables**
- Test suite at >90% coverage on new code
- Updated docs with agent-update markers
- Deployment-ready branch

**Evidence Expectations**
- CI green, e2e demo logs/video
- Security audit sign-off

**Commit Checkpoint**
- `git commit -m "chore(plan): complete phase 3 validation & handoff"`

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
- Action: Revert schema migration commits, drop vector columns/indexes via Drizzle rollback
- Data Impact: Loss of seeded vector data (backup seeds first)
- Estimated Time: 1-2 hours

#### Phase 3 Rollback
- Action: Vercel rollback to previous deployment tag
- Data Impact: Re-run seeds if partial vectors present; no user data affected
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
- Artifacts: PR links (e.g., schema-#12, rag-endpoints-#13, tests-#14, docs-#15); test coverage reports; e2e query logs/demo video; deployment URL.
- Follow-up: Seed production agronomy vectors (Owner: Database Specialist); monitor query hit rates/latency for 1 week (Devops Specialist); A/B test RAG quality vs. tools-only.

<!-- agent-update:end -->
```
