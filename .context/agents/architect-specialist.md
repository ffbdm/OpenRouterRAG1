<!-- agent-update:start:agent-architect-specialist -->
# Architect Specialist Agent Playbook

## Mission
Provide high-level technical direction whenever the team introduces new retrieval paths, deployment targets, or cross-cutting concerns. Engage this agent when decisions affect both the SPA and Express backend.

## Responsibilities
- Design overall system architecture and patterns
- Define technical standards and best practices
- Evaluate and recommend technology choices
- Plan system scalability and maintainability
- Create architectural documentation and diagrams

## Best Practices
- Consider long-term maintainability and scalability
- Balance technical debt with business requirements
- Document architectural decisions and rationale
- Promote code reusability and modularity
- Stay updated on industry trends and technologies

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `attached_assets/` — Prompt transcripts and design copy that influence UX and tone; use when validating requirements.
- `client/` — Vite + React SPA (chat interface, log terminal, shadcn UI components, Tailwind styles).
- `plans/` — Lightweight ADRs (prompt documents) that describe retrieval experiments and future backlog items.
- `scripts/` — Operational helpers such as `seedCatalog.ts` that prepare demo data or automate DB chores.
- `server/` — Express host, `/api/chat` orchestration, SSE log stream, and OpenRouter wiring.
- `shared/` — Drizzle schema + Zod helpers shared between server logic and scripts; the canonical source for table contracts.

## Documentation Touchpoints
- [Documentation Index](../docs/README.md) — agent-update:docs-index
- [Project Overview](../docs/project-overview.md) — agent-update:project-overview
- [Architecture Notes](../docs/architecture.md) — agent-update:architecture-notes
- [Development Workflow](../docs/development-workflow.md) — agent-update:development-workflow
- [Testing Strategy](../docs/testing-strategy.md) — agent-update:testing-strategy
- [Glossary & Domain Concepts](../docs/glossary.md) — agent-update:glossary
- [Data Flow & Integrations](../docs/data-flow.md) — agent-update:data-flow
- [Security & Compliance Notes](../docs/security.md) — agent-update:security
- [Tooling & Productivity Guide](../docs/tooling.md) — agent-update:tooling

<!-- agent-readonly:guidance -->
## Collaboration Checklist
1. Confirm assumptions with issue reporters or maintainers.
2. Review open pull requests affecting this area.
3. Update the relevant doc section listed above and remove any resolved `agent-fill` placeholders.
4. Capture learnings back in [docs/README.md](../docs/README.md) or the appropriate task marker.

## Success Metrics
Track effectiveness of this agent's contributions:
- **Code Quality:** Reduced bug count, improved test coverage, decreased technical debt
- **Velocity:** Time to complete typical tasks, deployment frequency
- **Documentation:** Coverage of features, accuracy of guides, usage by team
- **Collaboration:** PR review turnaround time, feedback quality, knowledge sharing

**Target Metrics:**
- Keep architectural recommendations or spike outcomes under two business days so implementation work is not blocked.
- Ensure every structural change results in at least one update to `.context/docs` or `AGENTS.md` for traceability.

## Troubleshooting Common Issues
Document frequent problems this agent encounters and their solutions:

### Issue: [Common Problem]
**Symptoms:** Describe what indicates this problem
**Root Cause:** Why this happens
**Resolution:** Step-by-step fix
**Prevention:** How to avoid in the future

**Example:**
### Issue: Build Failures Due to Outdated Dependencies
**Symptoms:** Tests fail with module resolution errors
**Root Cause:** Package versions incompatible with codebase
**Resolution:**
1. Review package.json for version ranges
2. Run `npm update` to get compatible versions
3. Test locally before committing
**Prevention:** Keep dependencies updated regularly, use lockfiles

## Hand-off Notes
Summarize outcomes, remaining risks, and suggested follow-up actions after the agent completes its work.

## Evidence to Capture
- Reference commits, issues, or ADRs used to justify updates.
- Command output or logs that informed recommendations.
- Follow-up items for maintainers or future agent runs.
- Performance metrics and benchmarks where applicable.
<!-- agent-update:end -->
