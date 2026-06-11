#!/usr/bin/env bash
# check-all.sh — Run all quality gates locally in the same order as CI.
#
# Usage:
#   ./scripts/ci/check-all.sh
#
# Exits with status 1 on first failure, matching CI behaviour where failures
# are visible by stage and stop the pipeline.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT"

echo "=== Install dependencies ==="
pnpm install --frozen-lockfile

echo ""
echo "=== Format check ==="
pnpm format:check

echo ""
echo "=== Lint ==="
pnpm lint

echo ""
echo "=== Status validation ==="
pnpm exec tsx scripts/ci/validate-status.ts

echo ""
echo "=== Type check ==="
pnpm typecheck

echo ""
echo "=== Unit tests ==="
pnpm test:unit

echo ""
echo "=== Build ==="
pnpm build

echo ""
echo "=== Security: Secrets scan ==="
pnpm security:secrets

echo ""
echo "=== Security: Dependency audit ==="
pnpm security:dependencies

echo ""
echo "=== All quality gates passed ==="
