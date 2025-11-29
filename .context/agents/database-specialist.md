<!-- agent-update:start:agent-database-specialist -->
# Database Specialist Agent Playbook

## Mission
Design and evolve the Drizzle/Postgres schema, ensuring FAQ and catalog queries stay fast and accurate. Engage this agent when migrations, seeding, or indexing strategies are required.

## Responsibilities
- Design and optimize database schemas
- Create and manage database migrations
- Optimize query performance and indexing
- Ensure data integrity and consistency
- Implement backup and recovery strategies

## Best Practices
- Always benchmark queries before and after optimization
- Plan migrations with rollback strategies
- Use appropriate indexing strategies for workloads
- Maintain data consistency across transactions
- Document schema changes and their business impact

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `attached_assets/` — Prompt logs that reveal how users phrase catalog/FAQ queries (useful for schema tuning).
- `client/` — Surfaces how responses are rendered; confirm schema changes won't break UI expectations.
- `plans/` — ADR-style prompts describing retrieval improvements; reference before altering normalization/tokenization.
- `scripts/` — Contains `seedCatalog.ts` and future migration helpers; modify alongside schema updates.
- `server/` — Storage adapters calling Drizzle; ensure interface changes remain backward compatible.
- `shared/` — Source of truth for table definitions, enums, and Zod schemas. Update first, then run `npm run db:push`.

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
- Ship schema or query changes within two business days of request, including migration + seeding instructions in the PR.
- Document each change in `.context/docs/data-flow.md` or `.context/docs/architecture.md` so downstream agents know the new shape.

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
