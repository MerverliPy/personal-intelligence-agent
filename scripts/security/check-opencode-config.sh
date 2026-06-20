#!/usr/bin/env bash
# check-opencode-config.sh — ADR-0008 effective-configuration smoke test.
#
# Verifies the canonical opencode.jsonc matches the accepted ADR-0008 decision.
# Uses Python to parse JSONC (comments + trailing commas). Runs as part of CI
# (check-all.sh) and the pre-push hook.
#
# Usage:
#   bash scripts/security/check-opencode-config.sh
#
# Exit code 0: all checks pass.
# Exit code 1: one or more checks failed — review output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

CONFIG_FILE="opencode.jsonc"
PACKAGE_FILE="package.json"
PASSED=0
FAILED=0

# Parse opencode.jsonc with Python (handles comments, trailing commas).
# Usage: jsonc_get <jq-style-path>
#   jsonc_get '.default_agent'
#   jsonc_get '.permission.task'
jsonc_get() {
  python3 -c "
import json, re, sys
with open('$CONFIG_FILE') as f:
    content = f.read()
# Remove // comments (preserve :// URLs by only matching // at line start or after non-:)
content = re.sub(r'(?<!:)//.*$', '', content, flags=re.MULTILINE)
# Remove trailing commas in objects and arrays
content = re.sub(r',\s*}', '}', content)
content = re.sub(r',\s*]', ']', content)
data = json.loads(content)
path = '$1'
# Simple dot-path traversal (handles .key.subkey only)
parts = path.lstrip('.').split('.')
val = data
for p in parts:
    val = val.get(p, val[p] if isinstance(val, dict) and p in val else None)
    if val is None:
        break
if isinstance(val, bool):
    print('true' if val else 'false')
elif isinstance(val, list):
    print('\n'.join(str(x) for x in val))
elif val is None:
    print('')
else:
    print(val)
" 2>/dev/null || echo ""
}

# jsonc_get_key: get a value from a dict key inside the config (for permission.bash["key"])
# Usage: jsonc_get_key '.permission.bash' 'git push*'
jsonc_get_key() {
  python3 -c "
import json, re, sys
with open('$CONFIG_FILE') as f:
    content = f.read()
content = re.sub(r'(?<!:)//.*$', '', content, flags=re.MULTILINE)
content = re.sub(r',\s*}', '}', content)
content = re.sub(r',\s*]', ']', content)
data = json.loads(content)
path = '$1'
key = '$2'
parts = path.lstrip('.').split('.')
val = data
for p in parts:
    val = val.get(p, {})
result = val.get(key, '') if isinstance(val, dict) else ''
print(result)
" 2>/dev/null || echo ""
}

echo "=== ADR-0008 Effective-Configuration Smoke Test ==="
echo ""

# ── Check 1: Exactly one root OpenCode configuration exists ──
echo -n "1. Exactly one root config file ... "
if [ -f "opencode.json" ]; then
  echo "FAILED — opencode.json still present (should have been removed per ADR-0008)"
  FAILED=$((FAILED + 1))
elif [ ! -f "$CONFIG_FILE" ]; then
  echo "FAILED — opencode.jsonc not found"
  FAILED=$((FAILED + 1))
else
  echo "PASSED (opencode.jsonc only)"
  PASSED=$((PASSED + 1))
fi

# ── Check 2: OpenCode version is 1.17.7 ──
echo -n "2. OpenCode version 1.17.7 ... "
PINNED_VERSION=$(python3 -c "import json; d=json.load(open('$PACKAGE_FILE')); print(d.get('devDependencies',{}).get('opencode-ai','') or d.get('dependencies',{}).get('opencode-ai',''))" 2>/dev/null || echo "")
if [ "$PINNED_VERSION" = "1.17.7" ]; then
  echo "PASSED ($PINNED_VERSION)"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — expected 1.17.7, found '${PINNED_VERSION:-not found}'"
  FAILED=$((FAILED + 1))
fi

# ── Check 3: Default agent is delivery ──
echo -n "3. Default agent is delivery ... "
DEFAULT_AGENT=$(jsonc_get '.default_agent')
if [ "$DEFAULT_AGENT" = "delivery" ]; then
  echo "PASSED ($DEFAULT_AGENT)"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — expected delivery, found '${DEFAULT_AGENT:-not set}'"
  FAILED=$((FAILED + 1))
fi

# ── Check 4: Sharing disabled ──
echo -n "4. Sharing disabled ... "
SHARE=$(jsonc_get '.share')
if [ "$SHARE" = "disabled" ]; then
  echo "PASSED"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — expected disabled, found '${SHARE:-not set}'"
  FAILED=$((FAILED + 1))
fi

# ── Check 5: Required instruction files loaded ──
echo -n "5. Instruction files loaded ... "
INSTRUCTIONS=$(jsonc_get '.instructions')
ALL_FOUND=true
for f in "AGENTS.md" ".ui-redesign/adapter/REPOSITORY_ADAPTER.md" ".ui-redesign/decisions/DECISION_LEDGER.md"; do
  if ! echo "$INSTRUCTIONS" | grep -qF "$f"; then
    echo ""
    echo "   FAILED — missing instruction file: $f"
    ALL_FOUND=false
    FAILED=$((FAILED + 1))
  fi
done
if $ALL_FOUND; then
  echo "PASSED (3 files)"
  PASSED=$((PASSED + 1))
fi

# ── Check 6: Task denied ──
echo -n "6. Task denied ... "
TASK=$(jsonc_get '.permission.task')
if [ "$TASK" = "deny" ]; then
  echo "PASSED"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — expected deny, found '${TASK:-not set}'"
  FAILED=$((FAILED + 1))
fi

# ── Check 7: Skill denied ──
echo -n "7. Skill denied ... "
SKILL=$(jsonc_get '.permission.skill')
if [ "$SKILL" = "deny" ]; then
  echo "PASSED"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — expected deny, found '${SKILL:-not set}'"
  FAILED=$((FAILED + 1))
fi

# ── Check 8: External-directory denied ──
echo -n "8. External-directory denied ... "
EXTDIR=$(jsonc_get '.permission.external_directory')
if [ "$EXTDIR" = "deny" ]; then
  echo "PASSED"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — expected deny, found '${EXTDIR:-not set}'"
  FAILED=$((FAILED + 1))
fi

# ── Check 9: Protected read/edit patterns denied ──
echo -n "9. Protected patterns denied ... "
PROTECTED=("*.env" "**/.env" "*.env.*" "**/.env.*" "*.pem" "**/*.pem" "*.key" "**/*.key" "*credentials*" "**/*credentials*" ".git/**" "**/.git/**")
READ_PROBLEMS=0
EDIT_PROBLEMS=0

for pattern in "${PROTECTED[@]}"; do
  RV=$(jsonc_get_key '.permission.read' "$pattern")
  [ "$RV" != "deny" ] && READ_PROBLEMS=$((READ_PROBLEMS + 1))
  EV=$(jsonc_get_key '.permission.edit' "$pattern")
  [ "$EV" != "deny" ] && EDIT_PROBLEMS=$((EDIT_PROBLEMS + 1))
done

if [ "$READ_PROBLEMS" -eq 0 ] && [ "$EDIT_PROBLEMS" -eq 0 ]; then
  echo "PASSED (${#PROTECTED[@]} read + edit patterns)"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — $READ_PROBLEMS read gaps, $EDIT_PROBLEMS edit gaps"
  FAILED=$((FAILED + 1))
fi

# ── Check 10: Destructive and publishing commands denied ──
echo -n "10. Destructive commands denied ... "
DESTRUCTIVE=("git reset*" "git clean*" "git restore*" "rm -rf *" "sudo *" "npm publish*" "pnpm publish*")
CMD_PROBLEMS=0

for cmd in "${DESTRUCTIVE[@]}"; do
  CV=$(jsonc_get_key '.permission.bash' "$cmd")
  [ "$CV" != "deny" ] && CMD_PROBLEMS=$((CMD_PROBLEMS + 1))
done

if [ "$CMD_PROBLEMS" -eq 0 ]; then
  echo "PASSED (${#DESTRUCTIVE[@]} commands)"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — $CMD_PROBLEMS commands not denied"
  FAILED=$((FAILED + 1))
fi

# ── Check 10a: git push is ask (not deny) ──
echo -n "10a. git push is ask ... "
PUSH_VAL=$(jsonc_get_key '.permission.bash' "git push*")
if [ "$PUSH_VAL" = "ask" ]; then
  echo "PASSED"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — expected 'ask', got '$PUSH_VAL'"
  FAILED=$((FAILED + 1))
fi

# ── Check 11: Expected read-only tools allowed ──
echo -n "11. Read-only tools allowed ... "
EXPECTED_TOOLS=("glob" "grep" "list" "lsp" "todowrite" "question")
TOOL_PROBLEMS=0

for tool in "${EXPECTED_TOOLS[@]}"; do
  TV=$(jsonc_get ".permission.$tool")
  [ "$TV" != "allow" ] && TOOL_PROBLEMS=$((TOOL_PROBLEMS + 1))
done

if [ "$TOOL_PROBLEMS" -eq 0 ]; then
  echo "PASSED (${#EXPECTED_TOOLS[@]} tools)"
  PASSED=$((PASSED + 1))
else
  echo "FAILED — $TOOL_PROBLEMS tools not allowed"
  FAILED=$((FAILED + 1))
fi

# ── Summary ──
echo ""
echo "=== Results: $PASSED passed, $FAILED failed ==="

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo "Configuration drift detected. Review the failures above."
  echo "The canonical config (opencode.jsonc) does not match ADR-0008 requirements."
  exit 1
fi

echo "ADR-0008 smoke test passed — configuration matches accepted decision."
exit 0
