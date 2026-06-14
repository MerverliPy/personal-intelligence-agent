#!/usr/bin/env python3
"""Validate the structural integrity of the OpenCode mobile UI redesign package."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    "README.md",
    "ARCHITECTURE.md",
    "INSTALLATION.md",
    "USAGE.md",
    "opencode.json.example",
    ".opencode/agents/mobile-ui-orchestrator.md",
    ".opencode/commands/mobile-ui-start.md",
    ".opencode/skills/approval-gated-redesign/SKILL.md",
    "adapters/repository-adapter.schema.json",
    "contracts/design-contract.schema.json",
    "contracts/decision-ledger.schema.json",
    "contracts/evidence-manifest.schema.json",
    "contracts/performance-budget.schema.json",
]

AGENT_REQUIRED_KEYS = {"description", "mode", "permission"}
SKILL_NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def frontmatter(path: Path) -> dict[str, str]:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        raise ValueError("missing opening YAML frontmatter delimiter")
    end = text.find("\n---\n", 4)
    if end < 0:
        raise ValueError("missing closing YAML frontmatter delimiter")

    result: dict[str, str] = {}
    for raw in text[4:end].splitlines():
        if raw and not raw.startswith((" ", "\t")) and ":" in raw:
            key, value = raw.split(":", 1)
            result[key.strip()] = value.strip()
    return result


def main() -> int:
    errors: list[str] = []

    for rel in REQUIRED:
        if not (ROOT / rel).is_file():
            errors.append(f"Missing required file: {rel}")

    for path in sorted((ROOT / "contracts").glob("*.json")) + sorted((ROOT / "adapters").glob("*.json")):
        try:
            json.loads(path.read_text(encoding="utf-8"))
        except Exception as exc:
            errors.append(f"Invalid JSON: {path.relative_to(ROOT)}: {exc}")

    try:
        json.loads((ROOT / "opencode.json.example").read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Invalid opencode.json.example: {exc}")

    agents = sorted((ROOT / ".opencode/agents").glob("*.md"))
    if len(agents) < 10:
        errors.append(f"Expected at least 10 agents, found {len(agents)}")

    primary_count = 0
    for path in agents:
        try:
            fm = frontmatter(path)
            missing = AGENT_REQUIRED_KEYS - set(fm)
            if missing:
                errors.append(f"{path.relative_to(ROOT)} missing keys: {sorted(missing)}")
            if fm.get("mode") == "primary":
                primary_count += 1
            if fm.get("mode") not in {"primary", "subagent", "all"}:
                errors.append(f"{path.relative_to(ROOT)} has invalid mode: {fm.get('mode')}")
        except Exception as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")

    if primary_count != 1:
        errors.append(f"Expected exactly one primary agent, found {primary_count}")

    commands = sorted((ROOT / ".opencode/commands").glob("*.md"))
    if len(commands) < 8:
        errors.append(f"Expected at least 8 commands, found {len(commands)}")
    for path in commands:
        try:
            fm = frontmatter(path)
            if "description" not in fm or "agent" not in fm:
                errors.append(f"{path.relative_to(ROOT)} must define description and agent")
        except Exception as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")

    skills = sorted((ROOT / ".opencode/skills").glob("*/SKILL.md"))
    if len(skills) < 5:
        errors.append(f"Expected at least 5 skills, found {len(skills)}")
    for path in skills:
        try:
            fm = frontmatter(path)
            name = fm.get("name", "")
            description = fm.get("description", "")
            if not SKILL_NAME_RE.fullmatch(name):
                errors.append(f"{path.relative_to(ROOT)} invalid skill name: {name!r}")
            if path.parent.name != name:
                errors.append(f"{path.relative_to(ROOT)} name does not match directory")
            if not description:
                errors.append(f"{path.relative_to(ROOT)} missing description")
        except Exception as exc:
            errors.append(f"{path.relative_to(ROOT)}: {exc}")

    if errors:
        print("PACKAGE VALIDATION FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print("PACKAGE VALIDATION PASSED")
    print(f"- Agents: {len(agents)}")
    print(f"- Commands: {len(commands)}")
    print(f"- Skills: {len(skills)}")
    print("- JSON contracts: valid")
    print("- Exactly one primary agent")
    return 0


if __name__ == "__main__":
    sys.exit(main())
