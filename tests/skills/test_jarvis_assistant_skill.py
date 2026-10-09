"""Contracts for the Jarvis assistant skill."""

from pathlib import Path

import hermes_yaml as yaml


SKILL_DIR = Path(__file__).resolve().parents[2] / "skills" / "productivity" / "jarvis-assistant"
SKILL_PATH = SKILL_DIR / "SKILL.md"


def _frontmatter() -> dict:
    text = SKILL_PATH.read_text(encoding="utf-8")
    end = text.index("\n---", 3)
    return yaml.safe_load(text[3:end])


def test_jarvis_blueprint_is_read_only_and_opt_in():
    from tools.blueprints import blueprint_to_job_spec, parse_blueprint

    spec = parse_blueprint(SKILL_PATH.read_text(encoding="utf-8"))
    assert spec is not None
    assert spec.skill_name == "jarvis-assistant"

    job = blueprint_to_job_spec(spec)
    assert job["skills"] == ["jarvis-assistant"]
    assert job["deliver"] == "origin"
    assert job["no_agent"] is False
    assert "Do not create events" in job["prompt"]
    assert "send messages" in job["prompt"]
    assert "schedule additional cron jobs" in job["prompt"]


def test_jarvis_declares_non_secret_config_only():
    fm = _frontmatter()
    hermes = fm["metadata"]["hermes"]
    keys = {entry["key"] for entry in hermes["config"]}

    assert keys == {
        "jarvis.language",
        "jarvis.timezone",
        "jarvis.briefing_day",
        "jarvis.voice_enabled",
        "jarvis.memory_review",
        "jarvis.task_source",
        "jarvis.email_mode",
        "jarvis.automation_review",
        "jarvis.max_agents",
        "jarvis.max_parallel",
        "jarvis.cost_tier",
        "jarvis.routing_mode",
        "jarvis.max_prompt_tokens",
        "jarvis.max_completion_tokens",
        "jarvis.max_estimated_cost_usd",
        "jarvis.orchestrator_model",
        "jarvis.specialist_model",
    }
    assert "required_environment_variables" not in fm


def test_jarvis_references_exist_and_cover_phase_one_and_two():
    body = SKILL_PATH.read_text(encoding="utf-8")
    required = {
        "references/persona.md",
        "references/memory-policy.md",
        "references/voice-setup.md",
        "references/morning-briefing.md",
        "references/productivity-operations.md",
        "references/approval-policy.md",
        "references/workflow-automation.md",
        "references/multi-agent-system.md",
        "references/ubuntu-deployment.md",
    }

    for rel in required:
        assert rel in body
        assert (SKILL_DIR / rel).is_file()

    assert "write memory" in (SKILL_DIR / "references/morning-briefing.md").read_text(encoding="utf-8")
    assert "paid" in (SKILL_DIR / "references/voice-setup.md").read_text(encoding="utf-8").lower()


def test_phase_two_productivity_contracts_are_draft_first():
    productivity = (SKILL_DIR / "references/productivity-operations.md").read_text(encoding="utf-8")
    approval = (SKILL_DIR / "references/approval-policy.md").read_text(encoding="utf-8")
    automation = (SKILL_DIR / "references/workflow-automation.md").read_text(encoding="utf-8")

    assert "drafts" in productivity
    assert "Never send an email" in productivity
    assert "Never create, move, cancel, or RSVP" in productivity
    assert "skills.config.jarvis.task_source" in productivity

    assert "Requires Approval" in approval
    assert "Approval batch format" in approval
    assert "Sending, replying to, forwarding" in approval
    assert "Creating, moving, cancelling" in approval

    assert "No cron job is created without explicit approval" in automation
    assert "`cronjob`" in automation
    assert "`kanban`" in automation
    assert "`memory`" in automation


def test_phase_three_multi_agent_contract_mentions_executable_helper():
    body = SKILL_PATH.read_text(encoding="utf-8")
    reference = (SKILL_DIR / "references" / "multi-agent-system.md").read_text(encoding="utf-8")

    assert "scripts/jarvis_multi_agent.py" in body
    assert "scripts/jarvis_multi_agent.py" in reference
    assert "external_actions_executed" in reference
    assert "instagram" in reference
    assert "email" in reference
    assert "research" in reference
    assert "business" in reference
