
<!-- agent-update:start:docs-index -->
# Documentation Index

This `.context/docs` folder is the canonical knowledge base for the repository. Start with the project overview, then drill into a specific guide whenever you change code touching that area.

## Core Guides
- [Project Overview](./project-overview.md) — mission, constraints, and directory map
- [Architecture Notes](./architecture.md) — runtime topology, service boundaries, and trade-offs
- [Development Workflow](./development-workflow.md) — branching, reviews, and local loops
- [Testing Strategy](./testing-strategy.md) — current quality levers and future coverage targets
- [Glossary & Domain Concepts](./glossary.md) — shared language for FAQs, catalog, and RAG
- [Data Flow & Integrations](./data-flow.md) — request lifecycle plus vendor touchpoints
- [Security & Compliance Notes](./security.md) — env vars, secrets handling, and incident hooks
- [Tooling & Productivity Guide](./tooling.md) — required CLIs, scripts, and editor tips

## Repository Snapshot
- `.context/agents/` — AI playbooks that mirror these docs
- `.context/docs/` — this directory; keep markers synchronized with agent files
- `AGENTS.md`
- `attached_assets/`
- `client/`
- `components.json`
- `design_guidelines.md`
- `drizzle.config.ts`
- `package-lock.json`
- `package.json`
- `plan-dynamicToolCalls.prompt.md`
- `plans/`
- `postcss.config.js`
- `scripts/`
- `server/`
- `shared/`
- `tailwind.config.ts`
- `tsconfig.json`
- `vercel.json`
- `vite.config.ts`

## Document Map
| Guide | File | AI Marker | Primary Inputs |
| --- | --- | --- | --- |
| Project Overview | `project-overview.md` | agent-update:project-overview | `AGENTS.md`, design guidelines, repo tree |
| Architecture Notes | `architecture.md` | agent-update:architecture-notes | `server/`, `client/`, `shared/schema.ts`, ADR notes in `plans/` |
| Development Workflow | `development-workflow.md` | agent-update:development-workflow | Branch protection rules, `package.json` scripts, deployment notes |
| Testing Strategy | `testing-strategy.md` | agent-update:testing-strategy | `package.json`, manual QA checklist, future test plans |
| Glossary & Domain Concepts | `glossary.md` | agent-update:glossary | FAQ catalog terms, RAG terminology, UX language |
| Data Flow & Integrations | `data-flow.md` | agent-update:data-flow | `server/routes.ts`, `server/storage.ts`, OpenRouter contract |
| Security & Compliance Notes | `security.md` | agent-update:security | `.env` requirements, `server/db.ts`, incident notes |
| Tooling & Productivity Guide | `tooling.md` | agent-update:tooling | `package.json` scripts, `drizzle.config.ts`, IDE configs |

<!-- agent-readonly:guidance -->
## AI Update Checklist
1. Gather context with `git status -sb` plus the latest commits touching `docs/` or `agents/`.
2. Compare the current directory tree against the table above; add or retire rows accordingly.
3. Update cross-links if guides moved or were renamed; keep anchor text concise.
4. Record sources consulted inside the commit or PR description for traceability.

<!-- agent-readonly:sources -->
## Acceptable Sources
- Repository tree and `package.json` scripts for canonical command names.
- Maintainer-approved issues, RFCs, or product briefs referenced in the repo.
- Release notes or changelog entries that announce documentation changes.

<!-- agent-update:end -->
