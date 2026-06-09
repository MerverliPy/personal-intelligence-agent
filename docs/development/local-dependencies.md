# Local Development Dependencies

This document describes how to run the local dependency environment for development and CI.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2+
- The following ports must be available on localhost:
  - `5432` (PostgreSQL)
  - `6379` (Redis)
  - `9000` (MinIO S3 API)
  - `9001` (MinIO Console)

## Quick start

Start all dependencies with one command:

```bash
./scripts/dev/start-deps.sh
```

This command:

1. Starts PostgreSQL 17 with pgvector, Redis 7, and MinIO (S3-compatible storage).
2. Waits for all health checks to pass.
3. Creates the `pia-local` MinIO bucket if it does not already exist.

## Services

| Service                  | Container      | Port                           | Credentials                 | Notes                                                          |
| ------------------------ | -------------- | ------------------------------ | --------------------------- | -------------------------------------------------------------- |
| PostgreSQL 17 + pgvector | `pia-postgres` | `5432`                         | `pia` / `pia-dev`           | Database: `pia`. Extensions: `vector`, `pg_trgm`, `uuid-ossp`. |
| Redis 7                  | `pia-redis`    | `6379`                         | None                        | —                                                              |
| MinIO (S3)               | `pia-minio`    | `9000` (API), `9001` (Console) | `minioadmin` / `minioadmin` | Bucket: `pia-local`                                            |

All services bind to `127.0.0.1` only and are not exposed to the network.

## Environment variables

The following `.env.example` settings match the default development services:

```
DATABASE_URL=postgresql://pia:pia-dev@localhost:5432/pia
REDIS_URL=redis://localhost:6379
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_BUCKET=pia-local
STORAGE_ACCESS_KEY_ID=minioadmin
STORAGE_SECRET_ACCESS_KEY=minioadmin
```

## Stopping and teardown

Stop services while preserving all data volumes:

```bash
./scripts/dev/stop-deps.sh
```

To stop services **and remove all volumes** (destroys all persisted data):

```bash
./scripts/dev/teardown-deps.sh
```

The teardown script prompts for confirmation before removing volumes.

## Health checks

Each service includes a health check that Docker Compose uses to determine readiness:

- **PostgreSQL**: `pg_isready -U pia -d pia`
- **Redis**: `redis-cli ping`
- **MinIO**: HTTP `GET /minio/health/live`

The `start-deps.sh` script uses `docker compose up --wait` to block until all services are healthy.

## Data volumes

Named volumes preserve data across container restarts and are not removed by `docker compose stop` or `docker compose down` (without `--volumes`).

| Volume              | Container Path             | Purpose                   |
| ------------------- | -------------------------- | ------------------------- |
| `pia-postgres-data` | `/var/lib/postgresql/data` | PostgreSQL data directory |
| `pia-redis-data`    | `/data`                    | Redis RDB/AOF persistence |
| `pia-minio-data`    | `/data`                    | MinIO object storage      |

## Security notes

- **All credentials are development-only**. Never use these credentials in production or any environment with real data.
- Services bind exclusively to `127.0.0.1` and are not reachable from other machines.
- The `.env.example` file contains only development defaults. Real credentials must be provided via environment variables in production.

## Troubleshooting

### Port conflicts

If any required ports are already in use, stop the conflicting process or modify the port mappings in `compose.yaml`.

### First start is slow

The first `docker compose up` pulls images. Subsequent starts are fast because images are cached and data volumes are retained.

### Reset to a clean state

```bash
./scripts/dev/teardown-deps.sh
./scripts/dev/start-deps.sh
```
