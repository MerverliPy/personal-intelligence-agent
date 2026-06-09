#!/usr/bin/env bash
# teardown-deps.sh — Stop local dependencies and remove all volumes.
#
# Destroys containers and named volumes. All persisted data is lost.
# Use only when you need a clean slate.
#
# Usage:
#   ./scripts/dev/teardown-deps.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== WARNING: This will remove all local data volumes ==="
echo "PostgreSQL, Redis, and MinIO data will be permanently deleted."
echo ""
read -rp "Are you sure? Type 'yes' to confirm: " confirm
if [ "$confirm" != "yes" ]; then
  echo "Teardown cancelled."
  exit 0
fi

cd "$REPO_ROOT"
echo "=== Tearing down containers and volumes ==="
docker compose down --volumes

echo ""
echo "=== All dependencies and volumes removed ==="
