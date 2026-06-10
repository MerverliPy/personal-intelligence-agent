import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StorageConfig,
  StorageProvider,
  UploadMetadata,
  UploadTarget,
  UploadCompletion,
  DownloadUrl,
} from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an object key: `{workspaceId}/{uploadId}`. */
function makeObjectKey(workspaceId: string, uploadId: string): string {
  if (!workspaceId || !uploadId) {
    throw new Error('Workspace ID and upload ID are required.');
  }
  // Prevent path traversal: reject `.`, `..`, `/` in IDs.
  if (workspaceId.includes('/') || workspaceId.includes('..')) {
    throw new Error('Invalid workspace ID.');
  }
  if (uploadId.includes('/') || uploadId.includes('..')) {
    throw new Error('Invalid upload ID.');
  }
  return `${workspaceId}/${uploadId}`;
}

/** Parse workspace and upload ID from an object key. */
function parseObjectKey(key: string): { workspaceId: string; uploadId: string } {
  const idx = key.indexOf('/');
  if (idx === -1) throw new Error(`Malformed object key: ${key}`);
  return {
    workspaceId: key.slice(0, idx),
    uploadId: key.slice(idx + 1),
  };
}

/** Default size limit: 100 MB. */
const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024;

/** Default upload URL expiry: 5 minutes. */
const UPLOAD_EXPIRY_SECONDS = 300;

/** Default download URL expiry: 10 minutes. */
const DOWNLOAD_EXPIRY_SECONDS = 600;

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates an S3-compatible {@link StorageProvider}.
 *
 * Works with AWS S3, MinIO, and other S3-compatible stores.
 * For MinIO (as in local dev), set `forcePathStyle: true`.
 */
export function createS3StorageProvider(config: StorageConfig): StorageProvider {
  const client = new S3Client({
    endpoint: config.endpoint,
    region: config.region ?? 'us-east-1',
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: config.forcePathStyle ?? true,
  });

  const bucket = config.bucket;

  return {
    // -----------------------------------------------------------------------
    // createUploadTarget
    // -----------------------------------------------------------------------
    async createUploadTarget(workspaceId: string, metadata: UploadMetadata): Promise<UploadTarget> {
      const uploadId = randomUUID();
      const key = makeObjectKey(workspaceId, uploadId);
      const maxSizeBytes = metadata.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
      const allowedTypes = metadata.mimeType ? [metadata.mimeType] : [];

      const url = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: metadata.mimeType,
          ContentLength: undefined, // Let client set it
        }),
        { expiresIn: UPLOAD_EXPIRY_SECONDS },
      );

      const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString();

      return { uploadId, uploadUrl: url, expiresAt, maxSizeBytes, allowedTypes };
    },

    // -----------------------------------------------------------------------
    // completeUpload
    // -----------------------------------------------------------------------
    async completeUpload(
      workspaceId: string,
      uploadId: string,
      expected?: Pick<UploadMetadata, 'expectedChecksumSha256' | 'maxSizeBytes'>,
    ): Promise<UploadCompletion> {
      const key = makeObjectKey(workspaceId, uploadId);

      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

      const size = head.ContentLength;
      if (size === undefined) {
        throw new Error('Object metadata missing content length.');
      }

      // Enforce size limit
      const maxSize = expected?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
      if (size > maxSize) {
        // Delete the oversized object
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        throw new Error(`Upload size ${size} exceeds maximum ${maxSize} bytes.`);
      }

      // Checksum: use S3-provided value if available, otherwise empty.
      // (The API layer should compute separately for full verification.)
      const s3Checksum = (head as unknown as Record<string, unknown>)['ChecksumSHA256'] as
        | string
        | undefined;
      const checksumSha256 = s3Checksum ?? '';
      if (expected?.expectedChecksumSha256 && s3Checksum) {
        if (s3Checksum !== expected.expectedChecksumSha256) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          throw new Error(
            `Checksum mismatch: expected ${expected.expectedChecksumSha256}, got ${s3Checksum}.`,
          );
        }
      }

      const mimeType = head.ContentType ?? 'application/octet-stream';

      return { objectKey: key, size, checksumSha256, mimeType };
    },

    // -----------------------------------------------------------------------
    // createDownloadUrl
    // -----------------------------------------------------------------------
    async createDownloadUrl(workspaceId: string, objectKey: string): Promise<DownloadUrl> {
      // Verify the key belongs to the claimed workspace.
      const parsed = parseObjectKey(objectKey);
      if (parsed.workspaceId !== workspaceId) {
        throw new Error('Object key does not belong to the specified workspace.');
      }

      const url = await getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
        { expiresIn: DOWNLOAD_EXPIRY_SECONDS },
      );

      const expiresAt = new Date(Date.now() + DOWNLOAD_EXPIRY_SECONDS * 1000).toISOString();

      return { downloadUrl: url, expiresAt };
    },

    // -----------------------------------------------------------------------
    // deleteObject
    // -----------------------------------------------------------------------
    async deleteObject(workspaceId: string, objectKey: string): Promise<void> {
      const parsed = parseObjectKey(objectKey);
      if (parsed.workspaceId !== workspaceId) {
        throw new Error('Object key does not belong to the specified workspace.');
      }

      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
    },
  };
}
