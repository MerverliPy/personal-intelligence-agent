import { describe, it, expect } from 'vitest';
import { roleAtLeast, ALL_WORKSPACE_ROLES } from '@pia/domain';
import type {
  WorkspaceRole,
  WorkspaceMembership,
  ProjectMembership,
  AuthorizationContext,
} from '@pia/domain';
import {
  evaluatePolicy,
  WORKSPACE_PERMISSION_ROLE,
  requireAuthorization,
  type MembershipProvider,
  type AuthorizedRequest,
} from '../src/rbac.js';
import type { ServerResponse } from 'node:http';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake MembershipProvider backed by in-memory maps. */
function fakeMembershipProvider(
  memberships: WorkspaceMembership[] = [],
  projectMemberships: ProjectMembership[] = [],
): MembershipProvider {
  const wsMap = new Map<string, WorkspaceMembership>();
  for (const m of memberships) {
    wsMap.set(`${m.workspaceId}:${m.userId}`, m);
  }
  const projMap = new Map<string, ProjectMembership>();
  for (const p of projectMemberships) {
    projMap.set(`${p.projectId}:${p.userId}`, p);
  }

  return {
    async getWorkspaceMembership(workspaceId, userId) {
      return wsMap.get(`${workspaceId}:${userId}`) ?? null;
    },
    async getProjectMembership(projectId, userId) {
      return projMap.get(`${projectId}:${userId}`) ?? null;
    },
  };
}

function makeMembership(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
): WorkspaceMembership {
  return { workspaceId, userId, role, status: 'ACTIVE' };
}

function makeProjectMembership(
  workspaceId: string,
  projectId: string,
  userId: string,
  role: WorkspaceRole,
): ProjectMembership {
  return { workspaceId, projectId, userId, role, status: 'ACTIVE' };
}

/** Create a fake ServerResponse that captures the status and body. */
function fakeResponse(): {
  res: ServerResponse;
  getStatus: () => number;
  getBody: () => unknown;
} {
  let status = 200;
  let body: unknown = null;
  const res = {
    writeHead(s: number, _headers?: Record<string, string>) {
      status = s;
      return res;
    },
    end(data?: string) {
      if (data) {
        try {
          body = JSON.parse(data);
        } catch {
          body = data;
        }
      }
      return res;
    },
  } as unknown as ServerResponse;
  return { res, getStatus: () => status, getBody: () => body };
}

// ---------------------------------------------------------------------------
// Domain: roleAtLeast
// ---------------------------------------------------------------------------

describe('roleAtLeast', () => {
  it('OWNER >= OWNER', () => expect(roleAtLeast('OWNER', 'OWNER')).toBe(true));
  it('OWNER >= ADMIN', () => expect(roleAtLeast('OWNER', 'ADMIN')).toBe(true));
  it('OWNER >= CURATOR', () => expect(roleAtLeast('OWNER', 'CURATOR')).toBe(true));
  it('OWNER >= MEMBER', () => expect(roleAtLeast('OWNER', 'MEMBER')).toBe(true));
  it('OWNER >= AUDITOR', () => expect(roleAtLeast('OWNER', 'AUDITOR')).toBe(true));

  it('ADMIN >= ADMIN', () => expect(roleAtLeast('ADMIN', 'ADMIN')).toBe(true));
  it('ADMIN >= CURATOR', () => expect(roleAtLeast('ADMIN', 'CURATOR')).toBe(true));
  it('ADMIN >= MEMBER', () => expect(roleAtLeast('ADMIN', 'MEMBER')).toBe(true));
  it('ADMIN >= AUDITOR', () => expect(roleAtLeast('ADMIN', 'AUDITOR')).toBe(true));
  it('ADMIN not >= OWNER', () => expect(roleAtLeast('ADMIN', 'OWNER')).toBe(false));

  it('CURATOR >= CURATOR', () => expect(roleAtLeast('CURATOR', 'CURATOR')).toBe(true));
  it('CURATOR >= MEMBER', () => expect(roleAtLeast('CURATOR', 'MEMBER')).toBe(true));
  it('CURATOR >= AUDITOR', () => expect(roleAtLeast('CURATOR', 'AUDITOR')).toBe(true));
  it('CURATOR not >= ADMIN', () => expect(roleAtLeast('CURATOR', 'ADMIN')).toBe(false));

  it('MEMBER >= MEMBER', () => expect(roleAtLeast('MEMBER', 'MEMBER')).toBe(true));
  it('MEMBER >= AUDITOR', () => expect(roleAtLeast('MEMBER', 'AUDITOR')).toBe(true));
  it('MEMBER not >= CURATOR', () => expect(roleAtLeast('MEMBER', 'CURATOR')).toBe(false));

  it('AUDITOR >= AUDITOR', () => expect(roleAtLeast('AUDITOR', 'AUDITOR')).toBe(true));
  it('AUDITOR not >= MEMBER', () => expect(roleAtLeast('AUDITOR', 'MEMBER')).toBe(false));

  it('ALL_WORKSPACE_ROLES contains all five roles in hierarchy order', () => {
    expect(ALL_WORKSPACE_ROLES).toEqual(['OWNER', 'ADMIN', 'CURATOR', 'MEMBER', 'AUDITOR']);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — workspace-scoped
// ---------------------------------------------------------------------------

describe('evaluatePolicy — workspace-scoped', () => {
  const ws1 = 'ws-11111111-1111-1111-1111-111111111111';
  const ws2 = 'ws-22222222-2222-2222-2222-222222222222';
  const alice = 'user-alice-1111-1111-1111-111111111111';
  const bob = 'user-bob-2222-2222-2222-222222222222';

  // Alice is OWNER of ws1, Bob is MEMBER of ws1, no one is member of ws2
  const membership = fakeMembershipProvider([
    makeMembership(ws1, alice, 'OWNER'),
    makeMembership(ws1, bob, 'MEMBER'),
  ]);

  it('OWNER can read workspace', async () => {
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('owner');
  });

  it('OWNER can update workspace', async () => {
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:update',
    });
    expect(result.decision).toBe('allow');
  });

  it('OWNER can delete workspace', async () => {
    // workspace:delete requires OWNER — Alice qualifies
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:delete',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('owner');
  });

  it('MEMBER can read workspace', async () => {
    const result = await evaluatePolicy(membership, {
      userId: bob,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('member');
  });

  it('MEMBER cannot update workspace (insufficient role)', async () => {
    const result = await evaluatePolicy(membership, {
      userId: bob,
      workspaceId: ws1,
      permission: 'workspace:update',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('insufficient_role');
  });

  it('MEMBER cannot delete workspace (requires OWNER)', async () => {
    const result = await evaluatePolicy(membership, {
      userId: bob,
      workspaceId: ws1,
      permission: 'workspace:delete',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('insufficient_role');
  });

  it('returns not_member for workspace the user does not belong to', async () => {
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws2,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('not_member');
  });

  it('deny-by-default for unknown permissions', async () => {
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'super:admin',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('unknown_permission');
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — project-scoped
// ---------------------------------------------------------------------------

describe('evaluatePolicy — project-scoped', () => {
  const ws1 = 'ws-11111111-1111-1111-1111-111111111111';
  const proj1 = 'proj-11111111-1111-1111-1111-111111111111';
  const proj2 = 'proj-22222222-2222-2222-2222-222222222222';
  const alice = 'user-alice-1111-1111-1111-111111111111';
  const bob = 'user-bob-2222-2222-2222-222222222222';

  // Alice is CURATOR on proj1, Bob is MEMBER on proj1.
  const membership = fakeMembershipProvider(
    [makeMembership(ws1, alice, 'OWNER'), makeMembership(ws1, bob, 'MEMBER')],
    [
      makeProjectMembership(ws1, proj1, alice, 'CURATOR'),
      makeProjectMembership(ws1, proj1, bob, 'MEMBER'),
    ],
  );

  it('project member can read project', async () => {
    const result = await evaluatePolicy(membership, {
      userId: bob,
      projectId: proj1,
      permission: 'project:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('member');
  });

  it('curator can update project', async () => {
    const result = await evaluatePolicy(membership, {
      userId: alice,
      projectId: proj1,
      permission: 'project:update',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('curator');
  });

  it('member cannot delete project (requires ADMIN)', async () => {
    const result = await evaluatePolicy(membership, {
      userId: bob,
      projectId: proj1,
      permission: 'project:delete',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('insufficient_role');
  });

  it('cross-workspace: workspace member but not project member is denied', async () => {
    // Alice is OWNER of ws1 but not a member of proj2
    const result = await evaluatePolicy(membership, {
      userId: alice,
      projectId: proj2,
      permission: 'project:read',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('not_member');
  });

  it('cross-workspace: project belongs to different workspace than requested', async () => {
    // proj1 belongs to ws1, but request claims ws2
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: 'ws-99999999-9999-9999-9999-999999999999',
      projectId: proj1,
      permission: 'project:read',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('cross_workspace');
  });
});

// ---------------------------------------------------------------------------
// evaluatePolicy — all roles and permissions
// ---------------------------------------------------------------------------

describe('evaluatePolicy — role coverage', () => {
  const ws1 = 'ws-11111111-1111-1111-1111-111111111111';
  const alice = 'user-alice-1111-1111-1111-111111111111';

  const allRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'CURATOR', 'MEMBER', 'AUDITOR'];

  /**
   * Expected overrides for the default mapping.
   *
   * Default mapping (from WORKSPACE_PERMISSION_ROLE):
   *   workspace:read       → AUDITOR
   *   workspace:update      → ADMIN
   *   workspace:delete      → OWNER
   *   workspace:manage_members → ADMIN
   *   project:create        → ADMIN
   *   project:read          → AUDITOR
   *   project:update        → CURATOR
   *   project:delete        → ADMIN
   *   project:manage_members → ADMIN
   *   knowledge:read        → AUDITOR
   *   knowledge:write       → MEMBER
   *   knowledge:curate      → CURATOR
   *   knowledge:delete      → ADMIN
   *   audit:read            → AUDITOR
   *   member:read           → AUDITOR
   *
   * Override: for each permission, list roles that should be DENIED
   * even though they technically satisfy the minimum (testing edge cases
   * where the simple mapping is enough).
   */
  const overrideDeny: Record<string, WorkspaceRole[]> = {
    // No overrides needed — the mapping is the truth.
  };

  for (const permission of Object.keys(WORKSPACE_PERMISSION_ROLE)) {
    const requiredRole = WORKSPACE_PERMISSION_ROLE[permission]!;
    for (const role of allRoles) {
      const shouldAllow = roleAtLeast(role, requiredRole);
      const overridden = overrideDeny[permission]?.includes(role) ?? false;
      const expectedDecision = shouldAllow && !overridden ? 'allow' : 'deny';

      it(`${role} performing '${permission}' → ${expectedDecision}`, async () => {
        const membership = fakeMembershipProvider([makeMembership(ws1, alice, role)]);
        const result = await evaluatePolicy(membership, {
          userId: alice,
          workspaceId: ws1,
          permission,
        });
        expect(result.decision).toBe(expectedDecision);
        expect(result.reasonCode).toBeDefined();
        expect(result.message).toBeDefined();
      });
    }
  }
});

// ---------------------------------------------------------------------------
// evaluatePolicy — stable reason codes
// ---------------------------------------------------------------------------

describe('evaluatePolicy — stable reason codes', () => {
  const ws1 = 'ws-11111111-1111-1111-1111-111111111111';
  const alice = 'user-alice-1111-1111-1111-111111111111';

  it('returns owner reason code for OWNER', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'OWNER')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('owner');
  });

  it('returns admin reason code for ADMIN', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'ADMIN')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('admin');
  });

  it('returns curator reason code for CURATOR', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'CURATOR')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('curator');
  });

  it('returns member reason code for MEMBER', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'MEMBER')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('member');
  });

  it('returns auditor reason code for AUDITOR', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'AUDITOR')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('allow');
    expect(result.reasonCode).toBe('auditor');
  });

  it('returns insufficient_role when role too low', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'MEMBER')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:delete',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('insufficient_role');
  });

  it('returns not_member for non-member', async () => {
    const membership = fakeMembershipProvider([]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('not_member');
  });

  it('returns cross_workspace for project in different workspace', async () => {
    const membership = fakeMembershipProvider(
      [],
      [makeProjectMembership('ws-other', 'proj-1', alice, 'MEMBER')],
    );
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: 'ws-wrong',
      projectId: 'proj-1',
      permission: 'project:read',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('cross_workspace');
  });

  it('returns unknown_permission for unmapped permission', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'OWNER')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      workspaceId: ws1,
      permission: 'nonexistent:action',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('unknown_permission');
  });

  it('returns deny_by_default when no workspace/project scope', async () => {
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'OWNER')]);
    const result = await evaluatePolicy(membership, {
      userId: alice,
      permission: 'workspace:read',
    });
    expect(result.decision).toBe('deny');
    expect(result.reasonCode).toBe('deny_by_default');
  });
});

// ---------------------------------------------------------------------------
// requireAuthorization middleware
// ---------------------------------------------------------------------------

describe('requireAuthorization middleware', () => {
  const ws1 = 'ws-11111111-1111-1111-1111-111111111111';
  const alice = 'user-alice-1111-1111-1111-111111111111';

  it('returns 401 when no session present', async () => {
    const { res, getStatus, getBody } = fakeResponse();
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'OWNER')]);
    const req = { session: undefined } as AuthorizedRequest;

    const result = await requireAuthorization(req, res, membership, {
      permission: 'workspace:read',
      getWorkspaceId: () => ws1,
    });

    expect(result).toBe(false);
    expect(getStatus()).toBe(401);
    expect(getBody()).toMatchObject({ error: 'unauthorized' });
  });

  it('returns 403 when user is not a workspace member', async () => {
    const { res, getStatus, getBody } = fakeResponse();
    const membership = fakeMembershipProvider([]);
    const req = {
      session: { userId: alice, email: 'a@b.com', issuer: 'iss', subject: 'sub' },
    } as AuthorizedRequest;

    const result = await requireAuthorization(req, res, membership, {
      permission: 'workspace:read',
      getWorkspaceId: () => ws1,
    });

    expect(result).toBe(false);
    expect(getStatus()).toBe(403);
    expect(getBody()).toMatchObject({ error: 'forbidden', reason: 'not_member' });
  });

  it('returns 403 with non-disclosing denial when insufficient role', async () => {
    const { res, getStatus, getBody } = fakeResponse();
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'AUDITOR')]);
    const req = {
      session: { userId: alice, email: 'a@b.com', issuer: 'iss', subject: 'sub' },
    } as AuthorizedRequest;

    const result = await requireAuthorization(req, res, membership, {
      permission: 'workspace:delete',
      getWorkspaceId: () => ws1,
    });

    expect(result).toBe(false);
    expect(getStatus()).toBe(403);
    const body = getBody() as Record<string, unknown>;
    expect(body['error']).toBe('forbidden');
    expect(body['message']).toBe('Access denied.');
    // Non-disclosing: does not leak what role is required
    expect(JSON.stringify(body)).not.toContain('OWNER');
    expect(JSON.stringify(body)).not.toContain('AUDITOR');
  });

  it('returns true when authorized', async () => {
    const { res } = fakeResponse();
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'OWNER')]);
    const req = {
      session: { userId: alice, email: 'a@b.com', issuer: 'iss', subject: 'sub' },
    } as AuthorizedRequest;

    const result = await requireAuthorization(req, res, membership, {
      permission: 'workspace:read',
      getWorkspaceId: () => ws1,
    });

    expect(result).toBe(true);
  });

  it('extracts workspace ID via custom function', async () => {
    const { res, getStatus } = fakeResponse();
    const membership = fakeMembershipProvider([makeMembership(ws1, alice, 'MEMBER')]);
    const req = {
      session: { userId: alice, email: 'a@b.com', issuer: 'iss', subject: 'sub' },
    } as AuthorizedRequest;

    // Custom function extracts workspaceId from a mock params/url
    const result = await requireAuthorization(req, res, membership, {
      permission: 'workspace:read',
      getWorkspaceId: () => ws1,
    });

    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Permission mapping coverage
// ---------------------------------------------------------------------------

describe('WORKSPACE_PERMISSION_ROLE mapping', () => {
  it('maps each permission to a valid role', () => {
    const validRoles = new Set(ALL_WORKSPACE_ROLES);
    for (const [perm, role] of Object.entries(WORKSPACE_PERMISSION_ROLE)) {
      expect(validRoles.has(role)).toBe(true);
      // Permission follows the resource:action pattern
      expect(perm).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });

  it('includes all required permission categories', () => {
    const perms = Object.keys(WORKSPACE_PERMISSION_ROLE);
    expect(perms).toContain('workspace:read');
    expect(perms).toContain('workspace:update');
    expect(perms).toContain('workspace:delete');
    expect(perms).toContain('workspace:manage_members');
    expect(perms).toContain('project:create');
    expect(perms).toContain('project:read');
    expect(perms).toContain('project:update');
    expect(perms).toContain('project:delete');
    expect(perms).toContain('project:manage_members');
    expect(perms).toContain('knowledge:read');
    expect(perms).toContain('knowledge:write');
    expect(perms).toContain('knowledge:curate');
    expect(perms).toContain('knowledge:delete');
    expect(perms).toContain('audit:read');
    expect(perms).toContain('member:read');
  });
});
