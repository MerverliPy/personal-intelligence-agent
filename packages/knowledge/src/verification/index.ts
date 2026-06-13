// ---------------------------------------------------------------------------
// Citation verification barrel exports (P3-T07)
// ---------------------------------------------------------------------------

export type {
  VerificationStatus,
  VerificationReasonCode,
  CitationVerification,
  VerificationResult,
  VerifierInput,
  VerifiableCitation,
} from './types.js';

export { verifyCitations } from './verifier.js';
