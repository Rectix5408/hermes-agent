# Jarvis Multi-Agent System

Jarvis Phase 3 adds a small executable orchestration helper at `scripts/jarvis_multi_agent.py`. It is not a new Hermes core tool. It is a skill-local component that creates bounded plans, runs safe local draft/analyze handlers, and emits structured JSON for Hermes to use with `delegate_task`, `kanban`, `cronjob`, and connector skills.

## Executable Component

Run from the skill directory:

```text
python scripts/jarvis_multi_agent.py plan --request "Plane Instagram Content und recherchiere Wettbewerber"
python scripts/jarvis_multi_agent.py orchestrate --request "Triagiere diese Inbox" --payload '{"messages":[...]}'
python scripts/jarvis_multi_agent.py run-agent instagram --request "Contentplan fuer Jarvis"
```

The helper never posts, sends email, changes calendars, creates cron jobs, or writes memory. It returns approval requirements for those actions.
Use `--routing-mode`, `--cost-tier`, `--max-cost-usd`, `--max-agents`, `--max-parallel`, `--max-steps`, `--max-prompt-tokens`, and `--max-completion-tokens` to keep orchestration bounded. Profile-level model routing is configured through `jarvis.orchestrator_model` and `jarvis.specialist_model`; the helper emits planning metadata and does not override Hermes provider selection.

## Agent Registry

| Agent | Scope | Real executable support |
|---|---|---|
| `instagram` | Ideas, editorial plan, captions, hashtags, post/reel/story drafts, stats summary from supplied data | Draft generation and content calendar. Meta API connection remains external. |
| `email` | Thread analysis, priority, reply drafts, follow-ups | Analysis from supplied messages. Gmail/IMAP reads remain connector-skill work. |
| `research` | Query planning, source comparison, source-aware handoff | Query planning and comparison of supplied sources. Live web reads use Hermes `web_search`/`web_extract`. |
| `business` | Project plan, task coordination, deadlines, workflow proposals | Deterministic project/task/workflow proposals. Kanban writes require approval. |

## Orchestration Rules

- Default maximum agents: 3.
- Default maximum parallel tasks: 2.
- No nested delegation from the helper.
- Every planned task declares `model_route: jarvis.specialist_model`; the plan itself declares `model_policy` for the orchestrator.
- Every planned task declares `routing_decision`, `token_budget`, and `estimated_prompt_tokens`.
- Routing modes are `local_only`, `local_first`, `smart`, and `cloud`.
- Deterministic draft/analyze handlers are preferred when the payload already contains the data needed for email, source comparison, business planning, or content planning.
- Share summaries, source links, IDs, approved drafts, and decisions only.
- Do not share raw inboxes, full calendars, secrets, tokens, or unnecessary transcript context.
- Prefer local or low-cost model routes for orchestration; use stronger cloud models only for tool-heavy or high-stakes reasoning.

## How Hermes Uses It

1. Call `plan` to classify intent and select agents.
2. For draft-only work, call `orchestrate` and present the result.
3. For live external reads, load the relevant skills and tools:
   - email/calendar: `google-workspace`, `himalaya`, `email-inbox-triage`;
   - research: `web_search`, `web_extract`, `browser_navigate`;
   - business: `kanban`, `cronjob`;
   - Instagram account stats or publishing preparation: Meta/Instagram plugin or MCP server when configured.
4. For longer work, create Kanban tasks from the plan rather than spawning recursive agents.
5. Consolidate results and present approval batches for external writes.

## Error Handling

- Missing integrations appear in `missing_integrations`.
- Unknown agents return `status: error`.
- Email without messages returns `status: blocked`.
- Research without sources returns a research plan instead of pretending sources were checked.
- Instagram without Meta credentials still creates drafts and marks account API as missing.

## Verification

- `external_actions_executed` is `false`.
- Every output has a `schema` for orchestration plans.
- Approval requirements are explicit.
- Results distinguish implemented local outputs from integration gaps.
