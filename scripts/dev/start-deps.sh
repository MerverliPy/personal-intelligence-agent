#!/usr/bin/env bash
# start-deps.sh — Start all local development dependencies.
#
# Starts PostgreSQL+pgvector, Redis, and MinIO via Docker Compose.
# Waits for health checks to pass and initializes the MinIO bucket.
# Volumes are preserved across restarts.
#
# Usage:
#   ./scripts/dev/start-deps.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "=== Starting local development dependencies ==="

cd "$REPO_ROOT"
docker compose up --detach --wait

echo ""
echo "=== Initializing MinIO bucket 'pia-local' ==="

# Use MinIO Client (mc) from the minio container to create the bucket.
# The bucket creation is idempotent — if the bucket already exists the command succeeds.
docker compose exec -T minio mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null || true
docker compose exec -T minio mc mb --ignore-existing local/pia-local 2>/dev/null || true

echo ""
echo "=== All dependencies ready ==="
echo "PostgreSQL (pgvector): postgresql://pia:pia-dev@localhost:5432/pia"
echo "Redis:                redis://localhost:6379"
echo "MinIO (S3):           http://localhost:9000 (bucket: pia-local)"
echo "MinIO Console:        http://localhost:9001 (minioadmin / minioadmin)"
echo ""
echo "Run './scripts/dev/stop-deps.sh' to stop."
echo "Run './scripts/dev/teardown-deps.sh' to stop and remove volumes."
