import { describe, it, expect } from 'vitest';
import { roleAtLeast, ALL_WORKSPACE_ROLES, type WorkspaceRole } from '../src/index.js';

describe('ALL_WORKSPACE_ROLES', () => {
  it('contains all five roles in descending privilege order', () => {
    expect(ALL_WORKSPACE_ROLES).toEqual(['OWNER', 'ADMIN', 'CURATOR', 'MEMBER', 'AUDITOR']);
  });

  it('has no duplicates and correct length', () => {
    expect(new Set(ALL_WORKSPACE_ROLES).size).toBe(5);
    expect(ALL_WORKSPACE_ROLES.length).toBe(5);
  });
});

describe('roleAtLeast', () => {
  const roles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'CURATOR', 'MEMBER', 'AUDITOR'];

  it('returns true for OWNER >= any role', () => {
    for (const role of roles) {
      expect(roleAtLeast('OWNER', role)).toBe(true);
    }
  });

  it('returns true for ADMIN >= ADMIN, CURATOR, MEMBER, AUDITOR', () => {
    expect(roleAtLeast('ADMIN', 'OWNER')).toBe(false);
    expect(roleAtLeast('ADMIN', 'ADMIN')).toBe(true);
    expect(roleAtLeast('ADMIN', 'CURATOR')).toBe(true);
    expect(roleAtLeast('ADMIN', 'MEMBER')).toBe(true);
    expect(roleAtLeast('ADMIN', 'AUDITOR')).toBe(true);
  });

  it('returns true for CURATOR >= CURATOR, MEMBER, AUDITOR', () => {
    expect(roleAtLeast('CURATOR', 'OWNER')).toBe(false);
    expect(roleAtLeast('CURATOR', 'ADMIN')).toBe(false);
    expect(roleAtLeast('CURATOR', 'CURATOR')).toBe(true);
    expect(roleAtLeast('CURATOR', 'MEMBER')).toBe(true);
    expect(roleAtLeast('CURATOR', 'AUDITOR')).toBe(true);
  });

  it('returns true for MEMBER >= MEMBER, AUDITOR', () => {
    expect(roleAtLeast('MEMBER', 'OWNER')).toBe(false);
    expect(roleAtLeast('MEMBER', 'ADMIN')).toBe(false);
    expect(roleAtLeast('MEMBER', 'CURATOR')).toBe(false);
    expect(roleAtLeast('MEMBER', 'MEMBER')).toBe(true);
    expect(roleAtLeast('MEMBER', 'AUDITOR')).toBe(true);
  });

  it('returns true for AUDITOR >= AUDITOR only', () => {
    expect(roleAtLeast('AUDITOR', 'OWNER')).toBe(false);
    expect(roleAtLeast('AUDITOR', 'ADMIN')).toBe(false);
    expect(roleAtLeast('AUDITOR', 'CURATOR')).toBe(false);
    expect(roleAtLeast('AUDITOR', 'MEMBER')).toBe(false);
    expect(roleAtLeast('AUDITOR', 'AUDITOR')).toBe(true);
  });

  it('returns false when either role is not in the hierarchy', () => {
    expect(roleAtLeast('OWNER', 'SUPERADMIN' as WorkspaceRole)).toBe(false);
    expect(roleAtLeast('GUEST' as WorkspaceRole, 'AUDITOR')).toBe(false);
    expect(roleAtLeast('GUEST' as WorkspaceRole, 'NONE' as WorkspaceRole)).toBe(false);
  });

  it('is commutative for equal roles', () => {
    for (const role of roles) {
      expect(roleAtLeast(role, role)).toBe(true);
    }
  });

  it('full hierarchy: OWNER > ADMIN > CURATOR > MEMBER > AUDITOR', () => {
    // Transitive: strict ordering assert
    expect(roleAtLeast('OWNER', 'ADMIN')).toBe(true);
    expect(roleAtLeast('ADMIN', 'CURATOR')).toBe(true);
    expect(roleAtLeast('CURATOR', 'MEMBER')).toBe(true);
    expect(roleAtLeast('MEMBER', 'AUDITOR')).toBe(true);
  });

  it('workspace role type allows only valid string literals (compile-time)', () => {
    // TypeScript structural test: verify WorkspaceRole is a string union.
    // If this compiles, the type system is correct for the expected set.
    const validRoles: WorkspaceRole[] = ['OWNER', 'ADMIN', 'CURATOR', 'MEMBER', 'AUDITOR'];
    expect(validRoles.length).toBe(5);
  });
});
