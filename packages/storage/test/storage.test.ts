import { describe, it, expect } from 'vitest';
import {
  createLocalStorageProvider,
  simulateUpload,
  type StorageProvider,
  type UploadTarget,
  type StoredObject,
} from '../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WS1 = 'ws-11111111-1111-1111-1111-111111111111';
const WS2 = 'ws-22222222-2222-2222-2222-222222222222';

function setup(): {
  provider: StorageProvider;
  store: Map<string, StoredObject>;
} {
  const { provider, getStore } = createLocalStorageProvider();
  return { provider, store: getStore() as Map<string, StoredObject> };
}

// ---------------------------------------------------------------------------
// createUploadTarget
// ---------------------------------------------------------------------------

describe('createUploadTarget', () => {
  it('generates a workspace-scoped upload target', async () => {
    const { provider } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    expect(target.uploadId).toBeDefined();
    expect(target.uploadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(target.uploadUrl).toContain(WS1);
    expect(target.uploadUrl).toContain(target.uploadId);
    expect(target.expiresAt).toBeDefined();
    expect(new Date(target.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('sets a 5-minute expiry on upload URLs', async () => {
    const { provider } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    const expiresMs = new Date(target.expiresAt).getTime() - Date.now();
    // Should be roughly 5 minutes (allow 10s tolerance)
    expect(expiresMs).toBeGreaterThan(290_000);
    expect(expiresMs).toBeLessThan(310_000);
  });

  it('enforces the configured max size', async () => {
    const { provider } = setup();
    const target = await provider.createUploadTarget(WS1, { maxSizeBytes: 42 });
    expect(target.maxSizeBytes).toBe(42);
  });

  it('defaults max size to 100 MB when not specified', async () => {
    const { provider } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    expect(target.maxSizeBytes).toBe(100 * 1024 * 1024);
  });

  it('returns allowed type when mimeType is specified', async () => {
    const { provider } = setup();
    const target = await provider.createUploadTarget(WS1, {
      mimeType: 'application/pdf',
    });
    expect(target.allowedTypes).toEqual(['application/pdf']);
  });

  it('returns empty allowed types when mimeType is not specified', async () => {
    const { provider } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    expect(target.allowedTypes).toEqual([]);
  });

  it('generates unique upload IDs for each call', async () => {
    const { provider } = setup();
    const t1 = await provider.createUploadTarget(WS1, {});
    const t2 = await provider.createUploadTarget(WS1, {});
    expect(t1.uploadId).not.toBe(t2.uploadId);
  });

  it('isolates upload targets between workspaces', async () => {
    const { provider } = setup();
    const t1 = await provider.createUploadTarget(WS1, {});
    const t2 = await provider.createUploadTarget(WS2, {});
    expect(t1.uploadUrl).toContain(WS1);
    expect(t2.uploadUrl).toContain(WS2);
    expect(t1.uploadUrl).not.toContain(WS2);
  });

  // --- Security: client cannot choose storage key ---
  it('generates the storage key server-side (client cannot choose)', async () => {
    const { provider } = setup();
    // The upload target contains an uploadUrl with the key embedded,
    // but the client never controls or supplies the key.
    const target = await provider.createUploadTarget(WS1, {});
    // The uploadId is a random UUID — not client-supplied.
    expect(target.uploadId).toMatch(/^[0-9a-f-]{36}$/);
  });

  // --- Security: path traversal prevention ---
  it('rejects workspace ID with path traversal (/)', async () => {
    const { provider } = setup();
    await expect(provider.createUploadTarget('ws/../evil', {})).rejects.toThrow(
      'Invalid workspace ID',
    );
  });

  it('rejects workspace ID with double dots (..)', async () => {
    const { provider } = setup();
    await expect(provider.createUploadTarget('..', {})).rejects.toThrow('Invalid workspace ID');
  });

  it('rejects empty workspace ID', async () => {
    const { provider } = setup();
    await expect(provider.createUploadTarget('', {})).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// completeUpload
// ---------------------------------------------------------------------------

describe('completeUpload', () => {
  it('returns object metadata after successful upload', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    // Simulate uploaded content
    simulateUpload(store, WS1, target.uploadId, 'hello world', 'text/plain');

    const completion = await provider.completeUpload(WS1, target.uploadId);
    expect(completion.objectKey).toContain(WS1);
    expect(completion.objectKey).toContain(target.uploadId);
    expect(completion.size).toBe(11); // 'hello world'
    expect(completion.mimeType).toBe('text/plain');
    expect(completion.checksumSha256).toBeDefined();
    expect(completion.checksumSha256.length).toBe(64); // SHA-256 hex
  });

  it('rejects completion for non-existent upload', async () => {
    const { provider } = setup();
    await expect(
      provider.completeUpload(WS1, '00000000-0000-0000-0000-000000000000'),
    ).rejects.toThrow('Object not found');
  });

  it('rejects oversized upload', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, { maxSizeBytes: 5 });

    simulateUpload(store, WS1, target.uploadId, 'too large!', 'text/plain');

    // Pass the size limit to completeUpload so the adapter enforces it.
    await expect(
      provider.completeUpload(WS1, target.uploadId, { maxSizeBytes: 5 }),
    ).rejects.toThrow('exceeds maximum');
  });

  it('removes oversized objects from store', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, { maxSizeBytes: 5 });

    simulateUpload(store, WS1, target.uploadId, 'too large!', 'text/plain');

    await expect(
      provider.completeUpload(WS1, target.uploadId, { maxSizeBytes: 5 }),
    ).rejects.toThrow();

    // Object should be deleted
    const key = `${WS1}/${target.uploadId}`;
    expect(store.has(key)).toBe(false);
  });

  it('verifies checksum and rejects mismatch', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    simulateUpload(store, WS1, target.uploadId, 'hello', 'text/plain');

    await expect(
      provider.completeUpload(WS1, target.uploadId, {
        expectedChecksumSha256: 'deadbeef',
      }),
    ).rejects.toThrow('Checksum mismatch');
  });

  it('removes objects with checksum mismatch from store', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    simulateUpload(store, WS1, target.uploadId, 'hello', 'text/plain');

    await expect(
      provider.completeUpload(WS1, target.uploadId, {
        expectedChecksumSha256: 'deadbeef',
      }),
    ).rejects.toThrow();

    const key = `${WS1}/${target.uploadId}`;
    expect(store.has(key)).toBe(false);
  });

  it('accepts checksum verification when correct', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    const data = 'test data';
    simulateUpload(store, WS1, target.uploadId, data, 'text/plain');

    // Compute expected checksum
    const { createHash } = await import('node:crypto');
    const expectedChecksum = createHash('sha256').update(data).digest('hex');

    const completion = await provider.completeUpload(WS1, target.uploadId, {
      expectedChecksumSha256: expectedChecksum,
    });
    expect(completion.checksumSha256).toBe(expectedChecksum);
  });

  it('idempotent completion returns same metadata twice', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');

    const c1 = await provider.completeUpload(WS1, target.uploadId);
    const c2 = await provider.completeUpload(WS1, target.uploadId);
    expect(c1.objectKey).toBe(c2.objectKey);
    expect(c1.size).toBe(c2.size);
    expect(c1.checksumSha256).toBe(c2.checksumSha256);
  });

  // --- Security: cross-workspace completion ---
  it('rejects completion from a different workspace', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');

    // Trying to complete WS1's upload under WS2's scope
    await expect(provider.completeUpload(WS2, target.uploadId)).rejects.toThrow('Object not found');
  });
});

// ---------------------------------------------------------------------------
// createDownloadUrl
// ---------------------------------------------------------------------------

describe('createDownloadUrl', () => {
  it('creates a short-lived download URL', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');
    const completion = await provider.completeUpload(WS1, target.uploadId);

    const download = await provider.createDownloadUrl(WS1, completion.objectKey);
    expect(download.downloadUrl).toBeDefined();
    expect(download.downloadUrl).toContain(completion.objectKey);
    expect(download.expiresAt).toBeDefined();

    const expiresMs = new Date(download.expiresAt).getTime() - Date.now();
    expect(expiresMs).toBeGreaterThan(590_000);
    expect(expiresMs).toBeLessThan(610_000); // 10 min
  });

  it('rejects download for object from a different workspace', async () => {
    const { provider, store } = setup();

    // Create object in ws1
    const target = await provider.createUploadTarget(WS1, {});
    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');
    const completion = await provider.completeUpload(WS1, target.uploadId);

    // Try to download ws1's object under ws2 using the same provider
    await expect(provider.createDownloadUrl(WS2, completion.objectKey)).rejects.toThrow(
      'does not belong',
    );
  });

  it('rejects malformed object keys', async () => {
    const { provider } = setup();
    await expect(provider.createDownloadUrl(WS1, 'no-slash-key')).rejects.toThrow(
      'Malformed object key',
    );
  });
});

// ---------------------------------------------------------------------------
// deleteObject
// ---------------------------------------------------------------------------

describe('deleteObject', () => {
  it('deletes an existing object', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');
    const completion = await provider.completeUpload(WS1, target.uploadId);

    await provider.deleteObject(WS1, completion.objectKey);
    expect(store.has(completion.objectKey)).toBe(false);
  });

  it('rejects delete for object from a different workspace', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');
    const completion = await provider.completeUpload(WS1, target.uploadId);

    // Create a different provider to simulate different workspace context
    const { provider: p2 } = setup();
    await expect(p2.deleteObject(WS2, completion.objectKey)).rejects.toThrow('does not belong');
  });

  it('does not throw when deleting non-existent object (idempotent)', async () => {
    const { provider } = setup();
    // Deleting a non-existent key should not throw from the S3 API.
    // The local adapter throws on workspace mismatch but succeeds on missing key.
    await expect(
      provider.deleteObject(WS1, `${WS1}/00000000-0000-0000-0000-000000000000`),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Security: storage credentials never reach the browser
// ---------------------------------------------------------------------------

describe('security — credential isolation', () => {
  it('does not expose storage credentials in UploadTarget', async () => {
    const { provider } = setup();
    const target = await provider.createUploadTarget(WS1, {});

    // The UploadTarget only contains uploadUrl, uploadId, expiresAt,
    // maxSizeBytes, and allowedTypes. It must NOT contain access keys,
    // secret keys, endpoints, or bucket names.
    const serialized = JSON.stringify(target);
    expect(serialized).not.toContain('minioadmin');
    expect(serialized).not.toContain('accessKey');
    expect(serialized).not.toContain('secretKey');
    expect(serialized).not.toContain('secretAccessKey');
  });

  it('does not expose storage credentials in DownloadUrl', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');
    const completion = await provider.completeUpload(WS1, target.uploadId);
    const download = await provider.createDownloadUrl(WS1, completion.objectKey);

    const serialized = JSON.stringify(download);
    expect(serialized).not.toContain('minioadmin');
    expect(serialized).not.toContain('accessKey');
    expect(serialized).not.toContain('secretKey');
    expect(serialized).not.toContain('secretAccessKey');
  });

  it('does not expose storage credentials in UploadCompletion', async () => {
    const { provider, store } = setup();
    const target = await provider.createUploadTarget(WS1, {});
    simulateUpload(store, WS1, target.uploadId, 'data', 'text/plain');
    const completion = await provider.completeUpload(WS1, target.uploadId);

    const serialized = JSON.stringify(completion);
    expect(serialized).not.toContain('minioadmin');
    expect(serialized).not.toContain('accessKey');
    expect(serialized).not.toContain('secretKey');
    expect(serialized).not.toContain('secretAccessKey');
  });
});

// ---------------------------------------------------------------------------
// Path traversal and key injection
// ---------------------------------------------------------------------------

describe('security — path traversal and key injection', () => {
  it('prevents key injection in workspace ID', async () => {
    const { provider } = setup();
    // Attempt to inject a key path into the workspace ID
    await expect(provider.createUploadTarget('../bucket/evil', {})).rejects.toThrow(
      'Invalid workspace ID',
    );
  });

  it('prevents nested path in workspace ID', async () => {
    const { provider } = setup();
    await expect(provider.createUploadTarget('ws1/sub/path', {})).rejects.toThrow(
      'Invalid workspace ID',
    );
  });

  it('prevents cross-workspace access via key manipulation', async () => {
    const { provider, store } = setup();
    // Create an object in ws1
    const target = await provider.createUploadTarget(WS1, {});
    simulateUpload(store, WS1, target.uploadId, 'secret', 'text/plain');
    const completion = await provider.completeUpload(WS1, target.uploadId);

    // Try to access ws1's object by claiming it belongs to ws2
    await expect(provider.createDownloadUrl(WS2, completion.objectKey)).rejects.toThrow(
      'does not belong',
    );
  });
});

// ---------------------------------------------------------------------------
// Workspace isolation
// ---------------------------------------------------------------------------

describe('workspace isolation', () => {
  it('maintains separate storage namespaces per workspace', async () => {
    const { provider, store } = setup();

    const t1 = await provider.createUploadTarget(WS1, {});
    const t2 = await provider.createUploadTarget(WS2, {});

    simulateUpload(store, WS1, t1.uploadId, 'ws1-data', 'text/plain');
    simulateUpload(store, WS2, t2.uploadId, 'ws2-data', 'text/plain');

    const c1 = await provider.completeUpload(WS1, t1.uploadId);
    const c2 = await provider.completeUpload(WS2, t2.uploadId);

    expect(c1.objectKey).toContain(WS1);
    expect(c2.objectKey).toContain(WS2);
    expect(c1.objectKey).not.toBe(c2.objectKey);

    // Download URLs respect workspace boundaries
    const d1 = await provider.createDownloadUrl(WS1, c1.objectKey);
    expect(d1.downloadUrl).toContain(WS1);
    expect(d1.downloadUrl).not.toContain(WS2);

    // Cannot cross-download
    await expect(provider.createDownloadUrl(WS1, c2.objectKey)).rejects.toThrow('does not belong');
  });
});
