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
2. [Ajuste Rag](./ajuste-rag.md)
3. [Ajusteembeddings](./ajusteembeddings.md)
4. [Catalog Ia Helper](./catalog-ia-helper.md)
5. [Catalogo Batelada](./catalogo-batelada.md)
6. [Classificacao](./classificacao.md)
7. [Context Chat](./context-chat.md)
8. [Double Instructions](./double-instructions.md)
9. [Habilitar Parsing No Backend](./habilitar-parsing-no-backend.md)
10. [Log Return Ia Form Db](./log-return-ia-form-db.md)
11. [Markdown Chat](./markdown-chat.md)
12. [One Shoot With Zero Tool Calls](./one-shoot-with-zero-tool-calls.md)
13. [Rag Context Catalog](./rag-context-catalog.md)
14. [Rag Context Catalog Discovery](./rag-context-catalog-discovery.md)
15. [Rag System Hybrid](./rag-system-hybrid.md)
16. [Simplify Flow Rag](./simplify-flow-rag.md)
17. [Ui Catalog](./ui-catalog.md)
18. [Whatsapp](./whatsapp.md)

## How To Create Or Update Plans
- Run "ai-context plan <name>" to scaffold a new plan template.
- Run "ai-context plan <name> --fill" (optionally with "--dry-run") to have an LLM refresh the plan using the latest repository context.
- Cross-link any new documentation or agent resources you introduce so future runs stay discoverable.

## Related Resources
- [Agent Handbook](../agents/README.md)
- [Documentation Index](../docs/README.md)
- [Agent Knowledge Base](../../AGENTS.md)
- [Contributor Guidelines](../../CONTRIBUTING.md)
