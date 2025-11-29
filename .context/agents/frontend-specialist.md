<!-- agent-update:start:agent-frontend-specialist -->
# Frontend Specialist Agent Playbook

## Mission
Own the chat UI, log terminal, and surrounding SPA experience. Engage this agent for UX changes, accessibility fixes, or state-management updates in the React layer.

## Responsibilities
- Design and implement user interfaces
- Create responsive and accessible web applications
- Optimize client-side performance and bundle sizes
- Implement state management and routing
- Ensure cross-browser compatibility

## Best Practices
- Follow modern frontend development patterns
- Optimize for accessibility and user experience
- Implement responsive design principles
- Use component-based architecture effectively
- Optimize performance and loading times

## Key Project Resources
- Documentation index: [docs/README.md](../docs/README.md)
- Agent handbook: [agents/README.md](./README.md)
- Agent knowledge base: [AGENTS.md](../../AGENTS.md)
- Contributor guide: [CONTRIBUTING.md](../../CONTRIBUTING.md)

## Repository Starting Points
- `attached_assets/` — Reference tone/UX cues when editing Portuguese copy or layouts.
- `client/` — React components, shadcn UI, hooks, Tailwind styles, and entry files.
- `plans/` — Notes on retrieval UX assumptions (e.g., catalog prompts) that should reflect in UI hints.
- `scripts/` — Use when you need deterministic data for UI demos (seed scripts).
- `server/` — Understand API payloads and debug metadata expected by the UI.
- `shared/` — Types that define API contracts; consume them for type-safe props and hooks.

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
- Land UI improvements within two business days, attaching screenshots or recordings for reviewers.
- Reflect UI changes in `.context/docs/tooling.md` or `.context/docs/project-overview.md` so onboarding remains accurate.

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
