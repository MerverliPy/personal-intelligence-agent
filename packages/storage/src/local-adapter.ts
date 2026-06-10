import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import type {
  StorageProvider,
  UploadTarget,
  UploadMetadata,
  UploadCompletion,
  DownloadUrl,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024;
const UPLOAD_EXPIRY_SECONDS = 300;
const DOWNLOAD_EXPIRY_SECONDS = 600;

function makeKey(workspaceId: string, uploadId: string): string {
  if (!workspaceId || !uploadId) throw new Error('Invalid IDs.');
  if (workspaceId.includes('/') || workspaceId.includes('..'))
    throw new Error('Invalid workspace ID.');
  if (uploadId.includes('/') || uploadId.includes('..')) throw new Error('Invalid upload ID.');
  return `${workspaceId}/${uploadId}`;
}

/** An object stored in the local in-memory store. */
export interface StoredObject {
  readonly data: Buffer;
  readonly mimeType: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an in-memory {@link StorageProvider} for unit testing.
 *
 * Behaves identically to the S3 adapter but stores everything in a Map.
 * Useful for testing security boundaries (path traversal, workspace scoping,
 * key injection) without a running object store.
 */
export function createLocalStorageProvider(): {
  provider: StorageProvider;
  /** Direct access to the in-memory store for test assertions. */
  getStore: () => ReadonlyMap<string, StoredObject>;
} {
  const store = new Map<string, StoredObject>();

  const provider: StorageProvider = {
    async createUploadTarget(workspaceId: string, metadata: UploadMetadata): Promise<UploadTarget> {
      const uploadId = randomUUID();
      const key = makeKey(workspaceId, uploadId);
      const maxSizeBytes = metadata.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
      const allowedTypes = metadata.mimeType ? [metadata.mimeType] : [];

      const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString();

      return {
        uploadId,
        uploadUrl: `local://upload/${key}`,
        expiresAt,
        maxSizeBytes,
        allowedTypes,
      };
    },

    async completeUpload(
      workspaceId: string,
      uploadId: string,
      expected?: Pick<UploadMetadata, 'expectedChecksumSha256' | 'maxSizeBytes'>,
    ): Promise<UploadCompletion> {
      const key = makeKey(workspaceId, uploadId);
      const obj = store.get(key);
      if (!obj) {
        throw new Error(`Object not found: ${key}`);
      }

      const size = obj.data.length;
      const maxSize = expected?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
      if (size > maxSize) {
        store.delete(key);
        throw new Error(`Upload size ${size} exceeds maximum ${maxSize} bytes.`);
      }

      const checksumSha256 = createHash('sha256').update(obj.data).digest('hex');
      if (expected?.expectedChecksumSha256 && checksumSha256 !== expected.expectedChecksumSha256) {
        store.delete(key);
        throw new Error(
          `Checksum mismatch: expected ${expected.expectedChecksumSha256}, got ${checksumSha256}.`,
        );
      }

      return { objectKey: key, size, checksumSha256, mimeType: obj.mimeType };
    },

    async createDownloadUrl(workspaceId: string, objectKey: string): Promise<DownloadUrl> {
      const idx = objectKey.indexOf('/');
      if (idx === -1) throw new Error(`Malformed object key: ${objectKey}`);
      if (objectKey.slice(0, idx) !== workspaceId) {
        throw new Error('Object key does not belong to the specified workspace.');
      }

      const expiresAt = new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000).toISOString();

      return { downloadUrl: `local://download/${objectKey}`, expiresAt };
    },

    async deleteObject(workspaceId: string, objectKey: string): Promise<void> {
      const idx = objectKey.indexOf('/');
      if (idx === -1) throw new Error(`Malformed object key: ${objectKey}`);
      if (objectKey.slice(0, idx) !== workspaceId) {
        throw new Error('Object key does not belong to the specified workspace.');
      }
      store.delete(objectKey);
    },
  };

  return { provider, getStore: () => store };
}

/**
 * Helper to simulate a client upload into the local store.
 *
 * Call this in tests between `createUploadTarget` and `completeUpload`
 * to place the uploaded content into the in-memory store.
 */
export function simulateUpload(
  store: Map<string, StoredObject>,
  workspaceId: string,
  uploadId: string,
  data: Buffer | string,
  mimeType = 'application/octet-stream',
): void {
  const key = makeKey(workspaceId, uploadId);
  store.set(key, { data: Buffer.isBuffer(data) ? data : Buffer.from(data), mimeType });
}
