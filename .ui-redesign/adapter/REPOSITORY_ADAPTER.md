# Repository Adapter

Status: `PROPOSED | APPROVED | SUPERSEDED`
Adapter ID:
Repository:
Commit baseline:
Approved by:
Approved at:

## Product

- Product purpose:
- Primary user classes:
- Critical user outcomes:
- Highest-priority screens and flows:
- Network requirement:
- PWA intent:

## Repository structure

- Frontend root:
- Backend root:
- Shared packages:
- Design-system location:
- Test locations:
- Documentation locations:
- Build output:
- Generated files:

## Stack detection

- Package manager:
- Runtime:
- Frontend framework:
- Styling system:
- State management:
- Routing:
- API architecture:
- Authentication:
- Persistence:
- PWA implementation:
- Existing browser automation:
- Existing accessibility tooling:
- Existing performance tooling:

## Commands

| Purpose | Command | Working directory | Mutates files | Approval |
|---|---|---|---|---|
| Install |  |  | yes | required |
| Start |  |  | no | required if network-exposed |
| Build |  |  | maybe | required |
| Lint |  |  | no | allowed |
| Typecheck |  |  | no | allowed |
| Unit tests |  |  | no | allowed |
| Integration tests |  |  | maybe | required |
| E2E tests |  |  | maybe | required |
| Accessibility |  |  | no | allowed |
| Performance |  |  | no | allowed |

## Runtime access

- Local URL:
- LAN URL:
- Secure tunnel:
- Staging URL:
- Installed-PWA launch URL:
- HTTPS requirement:
- CORS constraints:
- Browser test method:
- Physical-device bridge:

## Real data

- Environment:
- Data source:
- Authentication method:
- Read/write authority:
- Sensitive fields:
- Redaction policy:
- Data unavailable behavior: block, never invent.

## Protected areas

| Area | Paths/interfaces | Reason | Required approval |
|---|---|---|---|
| Authentication |  |  | separate |
| Authorization |  |  | separate |
| Public API |  |  | separate |
| Database schema |  |  | separate |
| Infrastructure |  |  | separate |
| Deployment |  |  | separate |
| Existing tests |  | baseline protection | contract |
| Other |  |  |  |

## Git policy

- Branch strategy:
- Worktree strategy:
- Commit convention:
- Pull-request timing:
- Protected branches:
- Required checks:
- Rollback method:

## Device matrix

| Environment | Priority | Required status |
|---|---:|---|
| iPhone 16 Pro Safari portrait | primary | mandatory |
| iPhone 16 Pro installed PWA portrait | primary | mandatory |
| iPhone 16 Pro iOS Chrome portrait | secondary | mandatory |
| Additional iPhone generation(s) | compatibility | mandatory |
| Desktop responsive browser(s) | compatibility | repository-defined |

## Approval

This adapter does not authorize product-code changes. It authorizes the detected operating context and the next baseline phase only.
