# External Technical Basis

Verified on 2026-06-09. Re-check before implementation when upstream behavior or configuration is material.

## OpenCode

- Project rules can be placed in a repository `AGENTS.md`: https://opencode.ai/docs/rules/
- Specialized primary agents and subagents can be defined in `.opencode/agents/`: https://opencode.ai/docs/agents/
- Reusable commands can be defined in `.opencode/commands/`: https://opencode.ai/docs/commands/
- On-demand skills can be defined in `.opencode/skills/<name>/SKILL.md`: https://opencode.ai/docs/skills/
- Permissions can be constrained globally and per agent: https://opencode.ai/docs/permissions/
- Repository configuration uses `opencode.json` or `opencode.jsonc`: https://opencode.ai/docs/config/

This bundle keeps `AGENTS.md` deliberately concise and moves task-specific detail into the machine-readable backlog, focused commands, and on-demand skills.

## OpenAI implementation direction

- Use the Responses API for new model/tool workflows: https://developers.openai.com/api/docs/guides/migrate-to-responses
- The Assistants API is scheduled to shut down on 2026-08-26: https://developers.openai.com/api/docs/assistants/migration
- Store production prompts in application source code; reusable prompt objects are scheduled to shut down on 2026-11-30: https://developers.openai.com/api/docs/guides/prompting
- The hosted Evals platform is scheduled to shut down on 2026-11-30, so this project uses portable datasets and scorers: https://developers.openai.com/api/docs/deprecations
- Agents SDK guardrails and human review distinguish automatic validation from approval-gated sensitive actions: https://developers.openai.com/api/docs/guides/agents/guardrails-approvals
- File search and retrieval support vector-store retrieval and metadata filtering; this project nevertheless preserves a provider-neutral internal retrieval contract: https://developers.openai.com/api/docs/guides/tools-file-search
