#!/usr/bin/env bash
# check-dependencies.sh — Audit installed dependencies for known vulnerabilities.
#
# Uses `pnpm audit --prod` to check only production dependencies against
# the public vulnerability database. Dev-only dependencies (test runners,
# build tools) are excluded because they do not ship to production.
# Any vulnerability finding causes a non-zero exit to ensure issues are
# visible in CI.
#
# Usage:
#   pnpm security:dependencies
#   ./scripts/security/check-dependencies.sh
#
# Exit code 0: no critical/high vulnerabilities.
# Exit code 1: vulnerabilities found or audit tool failed.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "=== Dependency vulnerability scan ==="
echo ""

# Run pnpm audit. pnpm audit exits 0 when no vulnerabilities are found.
# When vulnerabilities exist, it prints a report and exits non-zero.
# We capture the output and exit code separately.
AUDIT_OUTPUT=$(pnpm audit --prod 2>&1) || AUDIT_EXIT=$?

echo "$AUDIT_OUTPUT"

if [ "${AUDIT_EXIT:-0}" -ne 0 ]; then
  echo ""
  echo "=== Vulnerabilities detected ==="
  echo ""
  echo "Review the report above. Prioritize fixing critical and high-severity"
  echo "advisories. For each vulnerability, consider:"
  echo "  - Is the vulnerable package used in production code paths?"
  echo "  - Is a patched version available?"
  echo "  - Are there mitigating factors (e.g., the vulnerability requires"
  echo "    specific conditions not present in this deployment)?"
  echo ""
  echo "Document accepted risks in the task run record."
  exit 1
fi

echo ""
echo "No critical or high vulnerabilities detected."
