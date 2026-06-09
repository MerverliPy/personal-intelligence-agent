#!/usr/bin/env bash
# stop-deps.sh — Stop local development dependencies.
#
# Stops all services but preserves named volumes. Data is retained
# and will be available on the next start.
#
# Usage:
#   ./scripts/dev/stop-deps.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Stopping local development dependencies (volumes preserved) ==="

cd "$REPO_ROOT"
docker compose stop

echo ""
echo "=== All dependencies stopped (volumes preserved) ==="
echo "Run './scripts/dev/start-deps.sh' to start again."
echo "Run './scripts/dev/teardown-deps.sh' to remove volumes."
