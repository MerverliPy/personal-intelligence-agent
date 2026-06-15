/**
 * DPC-2: Native <dialog id="citation-modal"> focus behavior.
 *
 * Status: BLOCKED — requires an authenticated session to reach the
 * live API's conversation detail page where the native <dialog>
 * lives. Deferred to the implementation-contract integration test.
 *
 * Decision: PIA-MUR-D-016 AC6.
 */
import { test, expect, API_URL } from './helpers';

test.describe('DPC-2: native <dialog id="citation-modal"> focus (BLOCKED)', () => {
  test('deferred — requires authenticated session', async () => {
    // This test exists only to surface the BLOCKED status in the
    // evidence report. A real test would require a dev session
    // cookie, which is out of scope for the pre-flight.
    const res = await fetch(`${API_URL}/v1/me`);
    expect(res.status).toBe(401);
    test.skip(true, 'DPC-2 BLOCKED — requires authenticated session; deferred to implementation-contract');
  });
});
