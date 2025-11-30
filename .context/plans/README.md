# Collaboration Plans

This directory is the run queue for AI agents and maintainers coordinating work across documentation and playbooks. Treat the list below as an ordered backlog: finish the first plan before moving on to the next unless a human directs otherwise.

## Agent Execution Protocol
1. **Read the queue** from top to bottom. The numbering reflects execution priority.
2. **Open the plan file** (e.g., './plans/<slug>.md') and review the YAML front matter and the '<!-- agent-update:start:plan-... -->' wrapper so you understand the goal, required inputs, and success criteria.
3. **Gather context** by visiting the linked documentation and agent playbooks referenced in the "Agent Lineup" and "Documentation Touchpoints" tables.
4. **Execute the stages** exactly as written, capturing evidence and updating linked docs as instructed. If a stage cannot be completed, record the reason inside the plan before pausing.
5. **Close out the plan** by updating any TODOs, recording outcomes in the "Evidence & Follow-up" section, and notifying maintainers if human review is required.
6. **Return here** and pick the next plan in the queue. Always leave the README and plan files consistent with the work performed.

## Plan Queue (process in order)
1. [Add Ui Instructions For Changes](./add-ui-instructions-for-changes.md)
2. [Ajusteembeddings](./ajusteembeddings.md)
3. [Habilitar Parsing No Backend](./habilitar-parsing-no-backend.md)
4. [Log Return Ia Form Db](./log-return-ia-form-db.md)
5. [One Shoot With Zero Tool Calls](./one-shoot-with-zero-tool-calls.md)
6. [Rag Context Catalog](./rag-context-catalog.md)
7. [Rag Context Catalog Discovery](./rag-context-catalog-discovery.md)
8. [Rag System Hybrid](./rag-system-hybrid.md)
9. [Ui Catalog](./ui-catalog.md)

### Open Questions
- **Add Ui Instructions For Changes:** Schema não possui tabela/campos para instruções versionáveis; precisamos confirmar se novas entidades podem ser adicionadas em `shared/schema.ts` e quais perfis poderão editar esse conteúdo via UI (todo usuário autenticado ou somente admins?).

## How To Create Or Update Plans
- Run "ai-context plan <name>" to scaffold a new plan template.
- Run "ai-context plan <name> --fill" (optionally with "--dry-run") to have an LLM refresh the plan using the latest repository context.
- Cross-link any new documentation or agent resources you introduce so future runs stay discoverable.

## Related Resources
- [Agent Handbook](../agents/README.md)
- [Documentation Index](../docs/README.md)
- [Agent Knowledge Base](../../AGENTS.md)
- [Contributor Guidelines](../../CONTRIBUTING.md)
