# Development Guide

## Prerequisites

- **Node.js** >= 22 (see `.nvmrc`)
- **pnpm** 9.15.9
- **Docker** (for PostgreSQL, Redis, MinIO dependencies)
- **cloudflared** (optional, for remote access)

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Docker Dependencies

```bash
./scripts/dev/start-deps.sh
```

This starts PostgreSQL 17 (with pgvector), Redis 7, and MinIO.

### 3. Start the API Server

**Recommended method (persists across shell sessions):**

```bash
setsid node --env-file=.env --import tsx apps/api/src/index.ts &
disown
```

**Alternative method (using pnpm dev script):**

```bash
pnpm --filter @pia/api dev
```

**Verify the API is running:**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health/live
# Should return: 200
```

### 4. Start the Worker (Optional)

```bash
setsid node --env-file=.env --import tsx apps/worker/src/index.ts &
disown
```

Or using pnpm:

```bash
pnpm --filter @pia/worker dev
```

## Remote Access (iPhone/Mobile Testing)

### Generate a Cloudflared Tunnel

```bash
setsid cloudflared tunnel --no-autoupdate --url http://localhost:3000 &
disown
```

The output will include a URL like:

```
Your quick Tunnel has been created! Visit it at:
https://<random-subdomain>.trycloudflare.com
```

Open this URL in Safari on your iPhone.

### Install as PWA

1. Open the tunnel URL in Safari
2. Tap the **Share** button
3. Tap **"Add to Home Screen"**
4. Launch the app from your Home Screen

## Dev Scripts

All three apps now have working `dev` scripts:

| App    | Command                         | Description                                    |
| ------ | ------------------------------- | ---------------------------------------------- |
| API    | `pnpm --filter @pia/api dev`    | Starts the Fastify API server                  |
| Worker | `pnpm --filter @pia/worker dev` | Starts the background job consumer             |
| Web    | `pnpm --filter @pia/web dev`    | Library consumed by API (no standalone server) |

## Troubleshooting

### Command Appears to Hang

**Symptom:** Running `setsid node ... &` shows startup logs but never returns to the prompt.

**Cause:** The shell displays output from the background process but waits for it to complete (which it won't for a long-running server).

**Solution:** This is expected behavior. The process is running in the background. Press `Enter` to get a new prompt, or open a new terminal tab.

**Verify the process is running:**

```bash
ps aux | grep "apps/api/src/index.ts" | grep -v grep
```

### Port Already in Use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Solution:**

```bash
# Find the process using port 3000
lsof -i :3000

# Kill it
kill <PID>

# Or kill all API processes
pkill -f "apps/api/src/index.ts"
```

### Process Gets Killed When Shell Closes

**Symptom:** API stops working after closing the terminal.

**Cause:** Without `setsid`, child processes are killed when the parent shell exits.

**Solution:** Always use `setsid` to detach the process:

```bash
setsid node --env-file=.env --import tsx apps/api/src/index.ts &
disown
```

### API Returns 401 Unauthorized

**Symptom:** Pages show "UNAUTHORIZED: Authentication required."

**Cause:** Not logged in or session expired.

**Solution:** Click "Sign In" to authenticate via the dev bypass OIDC flow.

### Database Connection Errors

**Symptom:** API fails to start with database connection errors.

**Solution:**

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Restart dependencies if needed
./scripts/dev/stop-deps.sh
./scripts/dev/start-deps.sh
```

### Cloudflared Tunnel Not Working

**Symptom:** Tunnel URL returns 502 or connection refused.

**Solution:**

```bash
# Check if API is still running
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health/live

# If not, restart it
setsid node --env-file=.env --import tsx apps/api/src/index.ts &
disown

# Check if cloudflared is running
ps aux | grep cloudflared | grep -v grep

# If not, restart it
setsid cloudflared tunnel --no-autoupdate --url http://localhost:3000 &
disown
```

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

| Variable           | Default                                       | Description                           |
| ------------------ | --------------------------------------------- | ------------------------------------- |
| `PORT`             | 3000                                          | API server port                       |
| `HOST`             | 0.0.0.0                                       | API server bind address               |
| `DATABASE_URL`     | `postgresql://pia:pia-dev@localhost:5432/pia` | PostgreSQL connection string          |
| `REDIS_URL`        | `redis://localhost:6379`                      | Redis connection string               |
| `STORAGE_ENDPOINT` | `http://localhost:9000`                       | MinIO/S3 endpoint                     |
| `LOG_LEVEL`        | `info`                                        | Logging level                         |
| `MODEL_PROVIDER`   | `fake`                                        | LLM provider (fake, deepseek, openai) |

## Useful Commands

```bash
# Check API health
curl -s http://localhost:3000/health/live

# View API logs (if started with setsid)
# Check /tmp/api-restart.log or use journalctl

# Run tests
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:security

# Run evaluations
pnpm eval:retrieval
pnpm eval:answers

# Lint and typecheck
pnpm lint
pnpm typecheck

# Format code
pnpm format:fix
```
