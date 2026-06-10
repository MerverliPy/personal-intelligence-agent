// ---------------------------------------------------------------------------
// Scan provider interface and adapters
// ---------------------------------------------------------------------------
// Per docs/05_SECURITY_GOVERNANCE.md §7 File-processing controls:
//   - Allowed type list with actual-content detection
//   - Malware scanning before parsing/indexing
//   - Quarantine state and curator release process
//
// The ScanProvider abstracts MIME detection and malware scanning behind a
// replaceable adapter boundary. The noop adapter is for development/testing;
// production environments should plug in a real antivirus/content-inspection
// service.
// ---------------------------------------------------------------------------

/** Input required by a scan operation. */
export interface ScanInput {
  /** Workspace identifier for scoping. */
  readonly workspaceId: string;
  /** Server-assigned storage object key. */
  readonly objectKey: string;
  /** Actual object size in bytes. */
  readonly sizeBytes: number;
  /** SHA-256 checksum of the stored object. */
  readonly checksumSha256: string;
  /** MIME type as detected by the storage layer. */
  readonly storageMimeType: string;
  /** Original user-supplied filename. */
  readonly filename: string;
  /** MIME type declared by the client at upload initiation. */
  readonly declaredMimeType: string | null;
}

/**
 * Result of a scan operation.
 *
 * - `CLEAN`: no threats detected; safe to proceed to ingestion.
 * - `INFECTED`: malicious content detected; MUST quarantine.
 * - `PENDING`: scan is in progress (async); quarantine until complete.
 * - `ERROR`: scan failed unexpectedly; quarantine for curator review.
 */
export interface ScanResult {
  /** The final scan disposition. */
  readonly status: 'CLEAN' | 'INFECTED' | 'PENDING' | 'ERROR';
  /** Content-detected MIME type (may differ from declared). */
  readonly detectedMimeType: string | null;
  /** Provider-specific scan metadata. */
  readonly metadata: Record<string, unknown>;
}

/**
 * Abstraction over content scanning (MIME detection and malware analysis).
 *
 * Implementations MUST NOT have unrestricted network access and MUST
 * respect resource limits (CPU, memory, timeout) per the security
 * governance file-processing controls.
 */
export interface ScanProvider {
  /**
   * Scans an uploaded file for malware and detects its actual content type.
   *
   * This method may be called synchronously during upload completion
   * (for fast, in-process scanners) or may return a PENDING status
   * (for asynchronous scanning pipelines).
   */
  scan(input: ScanInput): Promise<ScanResult>;
}

// ---------------------------------------------------------------------------
// Noop adapter (development/testing only)
// ---------------------------------------------------------------------------

/**
 * Supported MIME types that can proceed to ingestion.
 * Extends the list from the security governance file-processing controls.
 */
const DEFAULT_ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // XLSX
  'application/json',
  'text/html',
]);

/**
 * Creates a no-operation scan provider for development and testing.
 *
 * Returns `CLEAN` for all files and sets the detected MIME type based on
 * the storage-layer MIME type (falling back to the declared type).
 *
 * **Not for production use.** Real deployments must plug in a content
 * inspection service.
 */
export function createNoopScanProvider(): ScanProvider {
  return {
    async scan(input: ScanInput): Promise<ScanResult> {
      const detectedMimeType = input.storageMimeType || input.declaredMimeType || null;

      return {
        status: 'CLEAN',
        detectedMimeType,
        metadata: {
          scanned: false,
          provider: 'noop',
          scannedAt: new Date().toISOString(),
        },
      };
    },
  };
}

/**
 * Returns `true` when the given MIME type is in the default allowed list.
 */
export function isDefaultAllowedMimeType(mimeType: string | null): boolean {
  if (!mimeType) return false;
  return DEFAULT_ALLOWED_MIME_TYPES.has(mimeType);
}

/**
 * Returns the set of default allowed MIME types as a readonly array.
 */
export function defaultAllowedMimeTypes(): readonly string[] {
  return [...DEFAULT_ALLOWED_MIME_TYPES];
}
