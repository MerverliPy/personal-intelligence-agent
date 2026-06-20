#!/usr/bin/env bash
# check-agent-permissions.sh — Verify secret-path deny patterns are consistent
# across all agents that should share the same deny list.
#
# AUD-P2-006: 7 agents share identical secret-path deny blocks. This test
# asserts they remain in sync. A security fix patching one and forgetting
# the other six would be caught here.
#
# Usage:
#   bash scripts/ci/check-agent-permissions.sh
#
# Exit code 0: all agents share canonical secret-path deny patterns.
# Exit code 1: divergence detected.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

# Canonical set of secret-path patterns that MUST appear as deny in all agents
CANONICAL_PATTERNS=(
  "'*.env': deny"
  "'**/.env': deny"
  "'*.env.*': deny"
  "'**/.env.*': deny"
  "'*.pem': deny"
  "'**/*.pem': deny"
  "'*.key': deny"
  "'**/*.key': deny"
  "'*credentials*': deny"
  "'**/*credentials*': deny"
  "'.git/**': deny"
  "'**/.git/**': deny"
)

# The 7 agents that must share these patterns (from audit AUD-P2-006)
AGENTS=(
  "delivery"
  "git-quality"
  "qa"
  "reviewer"
  "repository-integrity"
  "repository-docs"
  "security"
)

echo "=== Agent Permission Consistency Check ==="
echo ""

FAILED=0

for agent in "${AGENTS[@]}"; do
  AGENT_FILE=".opencode/agents/${agent}.md"
  if [ ! -f "$AGENT_FILE" ]; then
    echo "  SKIP: $agent — file not found"
    continue
  fi

  # Extract the read: section from the agent frontmatter
  READ_SECTION=$(sed -n '/^  read:/,/^  [a-z]/{/^  read:/d;/^  [a-z]/d;p;}' "$AGENT_FILE" 2>/dev/null || echo "")
  # Extract the edit: section from the agent frontmatter
  EDIT_SECTION=$(sed -n '/^  edit:/,/^  [a-z]/{/^  edit:/d;/^  [a-z]/d;p;}' "$AGENT_FILE" 2>/dev/null || echo "")

  MISSING_READ=0
  MISSING_EDIT=0
  for pattern in "${CANONICAL_PATTERNS[@]}"; do
    # Normalize pattern (remove leading/trailing whitespace, handle quoting)
    normalized=$(echo "$pattern" | sed "s/'/\"/g")
    if ! echo "$READ_SECTION" | grep -qF "$pattern" && ! echo "$READ_SECTION" | grep -qF "$normalized"; then
      MISSING_READ=$((MISSING_READ + 1))
    fi
    if ! echo "$EDIT_SECTION" | grep -qF "$pattern" && ! echo "$EDIT_SECTION" | grep -qF "$normalized"; then
      MISSING_EDIT=$((MISSING_EDIT + 1))
    fi
  done

  TOTAL_MISSING=$((MISSING_READ + MISSING_EDIT))
  if [ "$TOTAL_MISSING" -eq 0 ]; then
    echo "  ✓ $agent — all ${#CANONICAL_PATTERNS[@]} secret-path read + edit denies present"
  else
    [ "$MISSING_READ" -gt 0 ] && echo "  ✗ $agent — $MISSING_READ/${#CANONICAL_PATTERNS[@]} secret-path read-denies MISSING"
    [ "$MISSING_EDIT" -gt 0 ] && echo "  ✗ $agent — $MISSING_EDIT/${#CANONICAL_PATTERNS[@]} secret-path edit-denies MISSING"
    FAILED=1
  fi
done

echo ""

if [ "$FAILED" -eq 0 ]; then
  echo "All ${#AGENTS[@]} agents share the canonical secret-path deny patterns."
  exit 0
else
  echo "Permission drift detected! One or more agents are missing secret-path deny patterns."
  echo "Review the agent files listed above and restore the canonical deny list."
  exit 1
fi
