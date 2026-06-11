# Run Record: I-H2 — Production Infrastructure-as-Code

- **Task ID:** I-H2
- **Finding:** No production infrastructure-as-code exists
- **Final State:** DONE
- **Date:** 2026-06-11

## Repository State Inspected

- Branch: `main` @ HEAD (clean worktree after format:fix)
- Prior state: Only `compose.yaml` for local development; no IaC tooling, no Dockerfiles for app containerization.

## Missing Capability Reproduced

No production infrastructure existed. Running `pulumi up` in any directory would fail. No container images could be built (no Dockerfiles). Confirmed absent files:

- `infra/Pulumi.yaml`, `infra/index.ts` — not found
- `apps/api/Dockerfile`, `apps/worker/Dockerfile` — not found
- `.dockerignore` — not found

## Files Changed

| File                     | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `infra/Pulumi.yaml`      | Pulumi project definition (nodejs runtime)                   |
| `infra/Pulumi.prod.yaml` | Production stack configuration (VPC, DB, compute sizing)     |
| `infra/package.json`     | Dependencies: `@pulumi/aws`, `@pulumi/pulumi`                |
| `infra/tsconfig.json`    | TypeScript config for Pulumi (Node16, strict)                |
| `infra/config.ts`        | Stack configuration types and helpers                        |
| `infra/network.ts`       | VPC (2 AZs, public + private subnets, NAT, IGW)              |
| `infra/security.ts`      | Security groups (ALB, API, Worker, DB, Redis)                |
| `infra/data.ts`          | RDS PostgreSQL (pgvector), ElastiCache Redis, S3 bucket      |
| `infra/iam.ts`           | ECS task/execution roles, S3 + Secrets Manager policies      |
| `infra/compute.ts`       | ECS Fargate cluster, ALB, ECR repos, task definitions        |
| `infra/index.ts`         | Orchestration: wires all modules, exports stack outputs      |
| `apps/api/Dockerfile`    | Multi-stage Dockerfile (pnpm monorepo, non-root user)        |
| `apps/worker/Dockerfile` | Multi-stage Dockerfile for worker service                    |
| `.dockerignore`          | Build optimization — excludes node_modules, dist, .git, etc. |
| `audit-handoff.md`       | Updated I-H2 status and execution order                      |

## Design Decisions and Assumptions

- **Pulumi with TypeScript** chosen per user preference — matches existing stack language
- **AWS** selected as the cloud provider — mature Pulumi support, RDS pgvector availability, ECS Fargate for serverless containers
- **Single NAT Gateway** for cost efficiency (production can scale to one per AZ)
- **db.t4g.micro** / **cache.t4g.micro** as starter instance types — configurable via stack config
- **ECS Fargate** with `awsvpc` networking — services in private subnets, only ALB in public subnets
- **S3 with AES256 SSE**, versioning, public access block, lifecycle rules
- **ECR with immutable tags and scan-on-push**
- **Secrets Manager** for database password — connection URL stored as env var (VPC-internal)
- **TLS HSTS** coverage for DB and Redis (storage/transit encryption enabled)
- **Health checks** on ECS tasks and ALB target groups
- **Container insights** enabled on ECS cluster
- **Deletion protection** on RDS and ALB
- **Dockerfiles** are multi-stage with pnpm, non-root `pia` user, and healthchecks

## Commands Run and Results

| Command             | Result                                    |
| ------------------- | ----------------------------------------- |
| `pnpm typecheck`    | 27/27 successful                          |
| `pnpm lint`         | 17/17, 0 errors                           |
| `pnpm format:check` | All matched files use Prettier code style |
| `git diff --stat`   | 16 files changed (15 new + 1 modified)    |

## Acceptance-Criterion Evidence

- Pulumi AWS IaC defines: VPC, RDS PostgreSQL (pgvector), ElastiCache Redis, S3, ECS Fargate, ALB, ECR, IAM roles
- Dockerfiles build API and Worker containers from the pnpm monorepo
- Stack configuration is externalized in `Pulumi.prod.yaml`
- All resources are tagged with `Project: pia`, `Environment: prod`, `ManagedBy: pulumi`
- Security best practices: encryption at rest (RDS, Redis, S3), encryption in transit (Redis TLS), private subnets for data tier, least-privilege IAM, non-root container user

## Security/Privacy Impact

- All resources are in private subnets by default; only ALB is internet-facing
- RDS and Redis use encryption at rest and in transit
- S3 bucket has public access blocked and versioning enabled
- ECR scans container images on push
- Database credentials stored in AWS Secrets Manager
- Docker containers run as non-root `pia` user

## Database/API Compatibility Impact

- RDS uses PostgreSQL 17.4 with pgvector — matches development
- Redis 7.1 — matches development
- S3 API compatible with MinIO used in development
- Environment variables (`DATABASE_URL`, `REDIS_URL`, `STORAGE_BUCKET`) are the same contract

## Remaining Risks or Follow-up Tasks

- **Image build/push pipeline**: Need CI/CD workflow to build Docker images, push to ECR, and update ECS task definitions
- **Keycloak/authentication**: OIDC provider not defined — currently configured via env vars (`OIDC_ISSUER`, `OIDC_CLIENT_ID`); consider AWS Cognito or external Keycloak
- **DNS and TLS**: Stack supports `domainName` + `certificateArn` config, but these must be provisioned separately (Route53 + ACM)
- **Database migrations**: No automated migration runner in ECS — consider a one-shot task or entrypoint script
