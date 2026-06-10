import { describe, it, expect } from 'vitest';
import type { DocumentVersionStatus, IngestionJobStatus } from '../src/types.js';
import {
  isValidDocumentVersionTransition,
  allowedDocumentVersionTransitions,
  transitionDocumentVersion,
  isRetrievableVersion,
  isValidIngestionJobTransition,
  allowedIngestionJobTransitions,
  transitionIngestionJob,
} from '../src/state-machine.js';

// ---------------------------------------------------------------------------
// Document version state machine
// ---------------------------------------------------------------------------

describe('document version state machine', () => {
  describe('valid transitions', () => {
    const validCases: [DocumentVersionStatus, DocumentVersionStatus][] = [
      ['PENDING_UPLOAD', 'UPLOADED'],
      ['UPLOADED', 'QUARANTINED'],
      ['UPLOADED', 'INGESTING'],
      ['INGESTING', 'READY'],
      ['INGESTING', 'FAILED'],
      ['READY', 'SUPERSEDED'],
      ['READY', 'DELETED'],
      ['FAILED', 'INGESTING'],
    ];

    for (const [from, to] of validCases) {
      it(`allows ${from} -> ${to}`, () => {
        expect(isValidDocumentVersionTransition(from, to)).toBe(true);
        expect(transitionDocumentVersion(from, to)).toBe(to);
      });
    }
  });

  describe('invalid transitions', () => {
    const invalidCases: [DocumentVersionStatus, DocumentVersionStatus][] = [
      ['PENDING_UPLOAD', 'READY'],
      ['PENDING_UPLOAD', 'FAILED'],
      ['UPLOADED', 'READY'],
      ['QUARANTINED', 'UPLOADED'],
      ['QUARANTINED', 'READY'],
      ['QUARANTINED', 'INGESTING'],
      ['INGESTING', 'UPLOADED'],
      ['INGESTING', 'QUARANTINED'],
      ['READY', 'INGESTING'],
      ['READY', 'PENDING_UPLOAD'],
      ['READY', 'FAILED'],
      ['FAILED', 'READY'],
      ['FAILED', 'SUPERSEDED'],
      ['SUPERSEDED', 'READY'],
      ['SUPERSEDED', 'INGESTING'],
      ['DELETED', 'READY'],
      ['DELETED', 'INGESTING'],
    ];

    for (const [from, to] of invalidCases) {
      it(`rejects ${from} -> ${to}`, () => {
        expect(isValidDocumentVersionTransition(from, to)).toBe(false);
        expect(() => transitionDocumentVersion(from, to)).toThrow(
          `Illegal document version state transition: ${from} -> ${to}`,
        );
      });
    }
  });

  describe('allowedDocumentVersionTransitions', () => {
    it('returns correct next states for PENDING_UPLOAD', () => {
      expect(allowedDocumentVersionTransitions('PENDING_UPLOAD')).toEqual(['UPLOADED']);
    });

    it('returns correct next states for UPLOADED', () => {
      expect(allowedDocumentVersionTransitions('UPLOADED')).toEqual(['QUARANTINED', 'INGESTING']);
    });

    it('returns empty for terminal/blocked states', () => {
      expect(allowedDocumentVersionTransitions('QUARANTINED')).toEqual([]);
      expect(allowedDocumentVersionTransitions('DELETED')).toEqual([]);
      expect(allowedDocumentVersionTransitions('SUPERSEDED')).toEqual([]);
    });
  });

  describe('isRetrievableVersion', () => {
    it('returns true for READY', () => {
      expect(isRetrievableVersion('READY')).toBe(true);
    });

    it('returns false for non-ready states', () => {
      expect(isRetrievableVersion('PENDING_UPLOAD')).toBe(false);
      expect(isRetrievableVersion('UPLOADED')).toBe(false);
      expect(isRetrievableVersion('QUARANTINED')).toBe(false);
      expect(isRetrievableVersion('INGESTING')).toBe(false);
      expect(isRetrievableVersion('FAILED')).toBe(false);
      expect(isRetrievableVersion('SUPERSEDED')).toBe(false);
      expect(isRetrievableVersion('DELETED')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Ingestion job state machine
// ---------------------------------------------------------------------------

describe('ingestion job state machine', () => {
  describe('valid transitions', () => {
    const validCases: [IngestionJobStatus, IngestionJobStatus][] = [
      ['QUEUED', 'RUNNING'],
      ['RUNNING', 'SUCCEEDED'],
      ['RUNNING', 'RETRY_WAIT'],
      ['RUNNING', 'FAILED_FINAL'],
      ['RUNNING', 'CANCELLED'],
      ['RETRY_WAIT', 'RUNNING'],
    ];

    for (const [from, to] of validCases) {
      it(`allows ${from} -> ${to}`, () => {
        expect(isValidIngestionJobTransition(from, to)).toBe(true);
        expect(transitionIngestionJob(from, to)).toBe(to);
      });
    }
  });

  describe('invalid transitions', () => {
    const invalidCases: [IngestionJobStatus, IngestionJobStatus][] = [
      ['QUEUED', 'SUCCEEDED'],
      ['QUEUED', 'FAILED_FINAL'],
      ['QUEUED', 'RETRY_WAIT'],
      ['RUNNING', 'QUEUED'],
      ['SUCCEEDED', 'RUNNING'],
      ['SUCCEEDED', 'RETRY_WAIT'],
      ['FAILED_FINAL', 'RUNNING'],
      ['FAILED_FINAL', 'QUEUED'],
      ['CANCELLED', 'RUNNING'],
      ['CANCELLED', 'QUEUED'],
      ['RETRY_WAIT', 'SUCCEEDED'],
      ['RETRY_WAIT', 'QUEUED'],
    ];

    for (const [from, to] of invalidCases) {
      it(`rejects ${from} -> ${to}`, () => {
        expect(isValidIngestionJobTransition(from, to)).toBe(false);
        expect(() => transitionIngestionJob(from, to)).toThrow(
          `Illegal ingestion job state transition: ${from} -> ${to}`,
        );
      });
    }
  });

  describe('allowedIngestionJobTransitions', () => {
    it('returns correct next states for QUEUED', () => {
      expect(allowedIngestionJobTransitions('QUEUED')).toEqual(['RUNNING']);
    });

    it('returns correct next states for RUNNING', () => {
      expect(allowedIngestionJobTransitions('RUNNING')).toEqual([
        'SUCCEEDED',
        'RETRY_WAIT',
        'FAILED_FINAL',
        'CANCELLED',
      ]);
    });

    it('returns correct next states for RETRY_WAIT', () => {
      expect(allowedIngestionJobTransitions('RETRY_WAIT')).toEqual(['RUNNING']);
    });

    it('returns empty for terminal states', () => {
      expect(allowedIngestionJobTransitions('SUCCEEDED')).toEqual([]);
      expect(allowedIngestionJobTransitions('FAILED_FINAL')).toEqual([]);
      expect(allowedIngestionJobTransitions('CANCELLED')).toEqual([]);
    });
  });
});
