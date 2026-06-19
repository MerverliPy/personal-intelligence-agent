import { describe, expect, it } from 'vitest';
import {
  createNoopScanProvider,
  createUnavailableScanProvider,
  type ScanInput,
} from '../src/scan.js';

const input: ScanInput = {
  workspaceId: '11111111-1111-1111-1111-111111111111',
  objectKey: 'uploads/example.pdf',
  sizeBytes: 1024,
  checksumSha256: 'a'.repeat(64),
  storageMimeType: 'application/pdf',
  filename: 'example.pdf',
  declaredMimeType: 'application/pdf',
};

describe('scan providers', () => {
  it('fails closed when no scanner is configured', async () => {
    const result = await createUnavailableScanProvider().scan(input);

    expect(result).toMatchObject({
      status: 'ERROR',
      detectedMimeType: 'application/pdf',
      metadata: {
        scanned: false,
        provider: 'unavailable',
        errorCode: 'SCAN_PROVIDER_NOT_CONFIGURED',
      },
    });
  });

  it('keeps the no-op scanner available only for explicit test use', async () => {
    const result = await createNoopScanProvider().scan(input);

    expect(result).toMatchObject({
      status: 'CLEAN',
      detectedMimeType: 'application/pdf',
      metadata: {
        scanned: false,
        provider: 'noop',
      },
    });
  });
});
