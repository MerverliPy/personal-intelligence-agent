#!/usr/bin/env bash
# check-secrets.sh — Scan the repository for secret patterns.
#
# This script uses grep to detect patterns commonly found in credentials,
# API keys, tokens, and other secrets. It respects .gitignore and excludes
# files that legitimately contain secret references (documentation, examples).
#
# Usage:
#   pnpm security:secrets
#   ./scripts/security/check-secrets.sh
#
# Exit code 0: no secrets detected.
# Exit code 1: potential secrets found — review the output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

# Directories to exclude from scanning
EXCLUDE_DIRS=(
  ".git"
  "node_modules"
  ".turbo"
  "dist"
  ".next"
  "coverage"
  ".opencode"
  "ci-output"
  "test-results"
  "planning"
)

# Files to exclude from scanning (legitimate secret references)
EXCLUDE_FILES=(
  "docs/security/threat-model.md"
  "docs/security/review-checklist.md"
  "docs/05_SECURITY_GOVERNANCE.md"
  ".env.example"
  "pnpm-lock.yaml"
)

# Additional patterns to filter from grep output (known false-positive sources).
# These are files/directories that intentionally contain placeholder credentials
# for testing, development documentation, or demonstration purposes.
FILTER_OUT=(
  "packages/config/test/"
  "packages/observability/test/"
  "docs/development/"
  "scripts/dev/"
)

build_grep_excludes() {
  local pattern=""
  for dir in "${EXCLUDE_DIRS[@]}"; do
    pattern="${pattern} --exclude-dir=${dir}"
  done
  for file in "${EXCLUDE_FILES[@]}"; do
    pattern="${pattern} --exclude=${file}"
  done
  echo "$pattern"
}

EXCLUDES=$(build_grep_excludes)

# Secret patterns to detect (grep extended regex, case-insensitive)
# Each pattern should match a common secret format without excessive false positives.
# Patterns are intentionally broad to catch common mistakes; false positives are
# preferred over false negatives for a security scan.
PATTERNS=(
  # AWS keys
  'AKIA[0-9A-Z]{16}'
  # Private key headers
  '^-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
  # Generic token/key assignment patterns with plausible-looking values
  '[a-z0-9_]*api[_-]?key[a-z0-9_]*\s*[:=]\s*["'"'"']?[a-zA-Z0-9_\-+/]{20,}["'"'"']?'
  '[a-z0-9_]*secret[_-]?key[a-z0-9_]*\s*[:=]\s*["'"'"']?[a-zA-Z0-9_\-+/]{10,}["'"'"']?'
  '[a-z0-9_]*access[_-]?key[a-z0-9_]*\s*[:=]\s*["'"'"']?[a-zA-Z0-9_\-+/]{10,}["'"'"']?'
  # Bearer tokens (JWT-ish patterns)
  'Bearer\s+eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+'
  # Database URLs with embedded passwords
  '[a-z]+://[^:]+:[^@]+@'
  # GitHub tokens
  'ghp_[a-zA-Z0-9]{36}'
  'github_pat_[a-zA-Z0-9_]{22,}'
  # Generic high-entropy base64-like strings assigned to secret-sounding vars
  '[a-z0-9_]*password[a-z0-9_]*\s*[:=]\s*["'"'"']?[^"'"'"'\s]{8,}["'"'"']?'
  '[a-z0-9_]*token[a-z0-9_]*\s*[:=]\s*["'"'"']?[a-zA-Z0-9_\-+/]{20,}["'"'"']?'
  # Stripe keys
  'sk_live_[0-9a-zA-Z]{24,}'
  'pk_live_[0-9a-zA-Z]{24,}'
  # Generic JWT
  'eyJ[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+\.[a-zA-Z0-9_\-]+'
)

echo "=== Secret scan ==="

FOUND=0

for pattern in "${PATTERNS[@]}"; do
  MATCHES=$(grep -rIn $EXCLUDES -E "$pattern" . 2>/dev/null || true)

  if [ -n "$MATCHES" ]; then
    # Build dynamic filter patterns for known false-positive directories
    DIR_FILTER=""
    for fp in "${FILTER_OUT[@]}"; do
      DIR_FILTER="${DIR_FILTER} -e ^\./${fp}"
    done

    # Filter out known false positives: variable names in schema/config definitions,
    # test fixtures with placeholder values, and comments documenting patterns.
    FILTERED=$(echo "$MATCHES" | grep -v \
      -e "\.env\.example" \
      -e "secret.*false" \
      -e "'secret'" \
      -e '"secret"' \
      -e "description.*Secret" \
      -e "description.*secret" \
      -e "description.*token" \
      -e "description.*password" \
      -e "description.*credential" \
      -e "const.*SECRET" \
      -e "const.*TOKEN" \
      -e "const.*PASSWORD" \
      -e "SECRET_FIELD_NAMES" \
      -e "SENSITIVE_LOG_FIELDS" \
      -e "CONFIG_SCHEMA" \
      -e "redactSensitiveFields" \
      -e "redactRequired" \
      -e "Redacted" \
      -e "[Rr]edact" \
      -e '"[REDACTED]"' \
      -e "\[REDACTED\]" \
      -e "SKILL\.md" \
      $DIR_FILTER \
      || true)

    if [ -n "$FILTERED" ]; then
      echo ""
      echo "Pattern matched: $pattern"
      echo "$FILTERED"
      echo ""
      FOUND=1
    fi
  fi
done

if [ "$FOUND" -eq 0 ]; then
  echo ""
  echo "No secrets detected."
else
  echo ""
  echo "=== Potential secrets detected ==="
  echo "Review the output above. If any real secrets are present, revoke them"
  echo "immediately and remove them from the repository history."
  echo ""
  echo "Common causes of false positives:"
  echo "  - Placeholder values in test fixtures"
  echo "  - Base64-encoded test data"
  echo "  - Hashes in configuration files"
  echo "  - Documentation about secret formats"
  exit 1
fi
