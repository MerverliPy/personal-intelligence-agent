// ---------------------------------------------------------------------------
// Model routing policy — sensitivity-based provider eligibility
// ---------------------------------------------------------------------------
// Per P3-T01 acceptance criteria: Sensitivity/provider policy can deny routing
// before a request is sent. The policy is a pre-dispatch hook called by the
// gateway before any network request.
//
// The default implementation is permissive (allows all classes except
// PROHIBITED to all providers) and will be replaced with a full policy engine
// in later phases (P4 memory, P5 tools).
// ---------------------------------------------------------------------------

import type { SensitivityClass } from './types.js';

/**
 * Policy that controls whether a generation request can be routed to a
 * given provider based on the data sensitivity classification.
 *
 * Each provider adapter registers its permitted sensitivity classes.
 * Fallback providers MUST respect the same or stricter data policy
 * per `docs/05_SECURITY_GOVERNANCE.md#10`.
 */
export interface SensitivityPolicy {
  /**
   * Checks whether a request with the given maximum sensitivity class
   * may be routed to the specified provider.
   *
   * @returns `true` if routing is permitted, `false` to deny before dispatch.
   */
  canRoute(maximumSensitivity: SensitivityClass, provider: string): boolean;
}

/**
 * Default permissive sensitivity policy.
 *
 * Allows all sensitivity classes to all providers except `PROHIBITED`,
 * which is never routed externally. `PROHIBITED` data must use a
 * private/local inference path (per `docs/security/threat-model.md#controls`).
 */
export function createPermissiveSensitivityPolicy(): SensitivityPolicy {
  return {
    canRoute(maximumSensitivity: SensitivityClass, _provider: string): boolean {
      if (maximumSensitivity === 'PROHIBITED') return false;
      return true;
    },
  };
}
