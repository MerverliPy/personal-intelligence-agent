#!/usr/bin/env bash
# check-dependencies.sh — Audit installed dependencies for known vulnerabilities.
#
# Uses `pnpm audit --prod` to check production dependencies against
# the public vulnerability database. Dev-only dependencies are scanned
# separately as informational only (they do not block the pipeline but
# are reported for awareness).
# Production dependency vulnerability findings cause a non-zero exit;
# dev-only dependency findings are informational and non-blocking.
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

# ── Dev dependency audit (informational only) ──
echo ""
echo "=== Dev dependency advisory scan (informational) ==="
echo ""
echo "Scanning all dependencies including dev-only. Findings are reported"
echo "but do not block the pipeline. Dev dependencies do not ship to production."
echo ""

DEV_AUDIT_OUTPUT=$(pnpm audit 2>&1) || DEV_AUDIT_EXIT=$?

echo "$DEV_AUDIT_OUTPUT"

if [ "${DEV_AUDIT_EXIT:-0}" -ne 0 ]; then
  echo ""
  echo "=== Dev dependency advisories found (non-blocking) ==="
  echo ""
  echo "These advisories affect dev-only packages (build tools, test runners,"
  echo "linters). They do not impact production runtime. Review and track"
  echo "upstream fixes, but do not block releases on dev-only advisories"
  echo "unless a specific advisory is assessed as high-risk for this project."
else
  echo ""
  echo "No dev dependency advisories."
fi
