# Jarvis Memory Policy

Jarvis uses the existing Hermes `memory` tool and memory provider stack. Memory is for stable, reusable context, not for transcript storage.

## Store

Store only when it will help future sessions:

- Stable user preferences: language, tone, working hours, briefing sections.
- Reusable workflow preferences: how the user wants inbox triage, meeting prep, or summaries.
- Durable project facts the user explicitly treats as long-lived.
- Confirmed corrections to Jarvis behavior.

Keep entries short. One memory should usually be one fact or one preference.

## Do Not Store Without Explicit Approval

- API keys, tokens, passwords, OAuth URLs, recovery codes, or account identifiers.
- Raw email bodies, calendar descriptions, private messages, or contact lists.
- Health, legal, financial, employment, or family-sensitive details.
- Temporary tasks, one-off deadlines, or facts likely to expire soon.
- Guesses about the user.

## Write Procedure

1. Decide whether the fact is stable and useful.
2. If it is sensitive or ambiguous, ask for approval first.
3. Use `memory` with a compact sentence.
4. After writing, state exactly what was saved.

## Skill Preparation

When Jarvis repeats a multi-step workflow successfully, prepare it as procedural memory:

- For small personal habits, store a short memory.
- For a repeatable procedure, propose a new skill with `skill_manage`.
- For scheduled work, propose a blueprint or `cronjob` plan and wait for approval.

## Token Discipline

- Prefer concise preferences over long explanations.
- Do not copy tool output into memory.
- Replace stale entries instead of adding duplicates.
- If a memory would need more than three sentences, make it a skill or document instead.
