#!/usr/bin/env bash
# check-registry-counts.sh — Verify agent/command/skill counts match reality.
#
# Compares actual file counts against REGISTRY.md and README.md claims.
# Prevents drift between manifests and the filesystem.
#
# Usage:
#   bash scripts/ci/check-registry-counts.sh
#
# Exit code 0: all counts match.
# Exit code 1: drift detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

FAILED=0

# Actual counts
ACTUAL_AGENTS=$(ls .opencode/agents/*.md 2>/dev/null | wc -l)
ACTUAL_COMMANDS=$(ls .opencode/commands/*.md 2>/dev/null | wc -l)
ACTUAL_SKILLS=$(ls -d .opencode/skills/*/ 2>/dev/null | wc -l)

echo "=== Registry Count Validation ==="
echo ""

# Check agent count (count rows in the agent table only, between "## Agents" and "### Agent categories")
echo -n "Agents: $ACTUAL_AGENTS actual ... "
AGENT_TABLE_START=$(grep -n "^## Agents" .opencode/REGISTRY.md | cut -d: -f1)
AGENT_TABLE_END=$(grep -n "^### Agent categories" .opencode/REGISTRY.md | cut -d: -f1)
REGISTRY_AGENTS=$(sed -n "${AGENT_TABLE_START},${AGENT_TABLE_END}p" .opencode/REGISTRY.md | grep -c "^| \`" || echo 0)
README_AGENTS=$(grep -oP '\d+(?= agents)' README.md 2>/dev/null | head -1 || echo 0)

if [ "$REGISTRY_AGENTS" -eq "$ACTUAL_AGENTS" ] 2>/dev/null; then
  echo "REGISTRY.md: $REGISTRY_AGENTS ✓"
else
  echo "REGISTRY.md: $REGISTRY_AGENTS ✗ (expected $ACTUAL_AGENTS)"
  FAILED=1
fi

if [ "$README_AGENTS" -eq "$ACTUAL_AGENTS" ] 2>/dev/null; then
  echo "  README.md: $README_AGENTS ✓"
else
  echo "  README.md: $README_AGENTS ✗ (expected $ACTUAL_AGENTS)"
  FAILED=1
fi

# Check command count (count rows in command table only, between "## Commands" and "## Skills")
echo -n "Commands: $ACTUAL_COMMANDS actual ... "
CMD_TABLE_START=$(grep -n "^## Commands" .opencode/REGISTRY.md | cut -d: -f1)
CMD_TABLE_END=$(grep -n "^## Skills" .opencode/REGISTRY.md | cut -d: -f1)
REGISTRY_COMMANDS=$(sed -n "${CMD_TABLE_START},${CMD_TABLE_END}p" .opencode/REGISTRY.md | grep -c "^| \`/" || echo 0)
README_COMMANDS=$(grep -oP '\d+(?= commands)' README.md 2>/dev/null | head -1 || echo 0)

if [ "$REGISTRY_COMMANDS" -eq "$ACTUAL_COMMANDS" ] 2>/dev/null; then
  echo "REGISTRY.md: $REGISTRY_COMMANDS ✓"
else
  echo "REGISTRY.md: $REGISTRY_COMMANDS ✗ (expected $ACTUAL_COMMANDS)"
  FAILED=1
fi

if [ "$README_COMMANDS" -eq "$ACTUAL_COMMANDS" ] 2>/dev/null; then
  echo "  README.md: $README_COMMANDS ✓"
else
  echo "  README.md: $README_COMMANDS ✗ (expected $ACTUAL_COMMANDS)"
  FAILED=1
fi

# Check skill count (count rows in skill table only, between "## Skills" and "## CI Assertions")
echo -n "Skills: $ACTUAL_SKILLS actual ... "
SKILL_TABLE_START=$(grep -n "^## Skills" .opencode/REGISTRY.md | cut -d: -f1)
SKILL_TABLE_END=$(grep -n "^## CI Assertions" .opencode/REGISTRY.md | cut -d: -f1)
SKILL_TABLE_COUNT=$(sed -n "${SKILL_TABLE_START},${SKILL_TABLE_END}p" .opencode/REGISTRY.md | grep -c "^| \`" || echo 0)

if [ "$SKILL_TABLE_COUNT" -eq "$ACTUAL_SKILLS" ] 2>/dev/null; then
  echo "REGISTRY.md: $SKILL_TABLE_COUNT ✓"
else
  echo "REGISTRY.md: $SKILL_TABLE_COUNT ✗ (expected $ACTUAL_SKILLS)"
  FAILED=1
fi

echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "All registry counts match actual files."
  exit 0
else
  echo "Registry count drift detected. Update REGISTRY.md or README.md."
  echo "Run: ls .opencode/agents/*.md | wc -l"
  echo "Run: ls .opencode/commands/*.md | wc -l"
  echo "Run: ls -d .opencode/skills/*/ | wc -l"
  exit 1
fi
