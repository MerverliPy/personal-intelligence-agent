import { describe, it, expect } from 'vitest';
import { mapDbRoleToGateway, mapGatewayRoleToDb } from '../src/assistant/role-mapping.js';

describe('Role mapping', () => {
  describe('mapDbRoleToGateway', () => {
    it('maps USER to user', () => {
      expect(mapDbRoleToGateway('USER')).toBe('user');
    });
    it('maps ASSISTANT to assistant', () => {
      expect(mapDbRoleToGateway('ASSISTANT')).toBe('assistant');
    });
    it('maps SYSTEM_NOTE to system', () => {
      expect(mapDbRoleToGateway('SYSTEM_NOTE')).toBe('system');
    });
    it('maps TOOL to tool', () => {
      expect(mapDbRoleToGateway('TOOL')).toBe('tool');
    });
  });

  describe('mapGatewayRoleToDb', () => {
    it('maps user to USER', () => {
      expect(mapGatewayRoleToDb('user')).toBe('USER');
    });
    it('maps assistant to ASSISTANT', () => {
      expect(mapGatewayRoleToDb('assistant')).toBe('ASSISTANT');
    });
    it('maps system to SYSTEM_NOTE', () => {
      expect(mapGatewayRoleToDb('system')).toBe('SYSTEM_NOTE');
    });
    it('maps tool to TOOL', () => {
      expect(mapGatewayRoleToDb('tool')).toBe('TOOL');
    });
  });

  describe('round-trip', () => {
    const dbRoles = ['USER', 'ASSISTANT', 'SYSTEM_NOTE', 'TOOL'] as const;
    for (const dbRole of dbRoles) {
      it(`${dbRole} round-trips correctly`, () => {
        const gw = mapDbRoleToGateway(dbRole);
        const back = mapGatewayRoleToDb(gw);
        expect(back).toBe(dbRole);
      });
    }

    const gwRoles = ['user', 'assistant', 'system', 'tool'] as const;
    for (const gwRole of gwRoles) {
      it(`${gwRole} round-trips correctly`, () => {
        const db = mapGatewayRoleToDb(gwRole);
        const back = mapDbRoleToGateway(db);
        expect(back).toBe(gwRole);
      });
    }
  });
});
