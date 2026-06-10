// ---------------------------------------------------------------------------
// Audit event types
// ---------------------------------------------------------------------------

/** The type of actor that performed the auditable action. */
export type ActorType = 'user' | 'service';

/** Outcome of an auditable action. */
export type AuditOutcome = 'success' | 'failure' | 'denied';

/**
 * Input provided by the caller when recording an audit event.
 *
 * The writer redacts `metadata` before persisting. Do NOT pass secrets
 * or raw sensitive payloads — these fields are logged as structured metadata
 * only, per the security governance spec §9.
 */
export interface AuditEventInput {
  /** Workspace scope of the event. */
  workspaceId?: string;
  /** Internal user ID or service identity that performed the action. */
  actorId?: string;
  /** Whether the actor is a user or a system service. */
  actorType: ActorType;
  /** Stable action identifier, e.g. `auth.denied`, `membership.changed`. */
  action: string;
  /** Type of resource the action was performed on. */
  resourceType?: string;
  /** ID of the resource the action was performed on. */
  resourceId?: string;
  /** Outcome of the action. */
  outcome: AuditOutcome;
  /** Machine-readable reason code (e.g. from the authorization service). */
  reasonCode?: string;
  /** Correlation ID from the originating request or job. */
  requestId: string;
  /** OpenTelemetry trace ID, if available. */
  traceId?: string;
  /** Stable policy decision context, if applicable. */
  policyDecision?: Record<string, unknown>;
  /** Structured metadata (will be redacted before persistence). */
  metadata?: Record<string, unknown>;
}

/**
 * A persisted audit event as returned by the reader.
 */
export interface AuditEvent {
  /** Event UUID. */
  id: string;
  /** Workspace scope. */
  workspaceId: string | null;
  /** Actor internal ID. */
  actorId: string | null;
  /** Actor type. */
  actorType: ActorType;
  /** Action identifier. */
  action: string;
  /** Resource type. */
  resourceType: string | null;
  /** Resource ID. */
  resourceId: string | null;
  /** Outcome. */
  outcome: AuditOutcome;
  /** Reason code. */
  reasonCode: string | null;
  /** Correlation ID. */
  requestId: string;
  /** Trace ID. */
  traceId: string | null;
  /** Policy decision context. */
  policyDecision: Record<string, unknown> | null;
  /** Redacted metadata (secrets and sensitive fields removed). */
  redactedMetadata: Record<string, unknown>;
  /** When the event occurred. */
  occurredAt: Date;
}

// ---------------------------------------------------------------------------
// Audit query / filter types
// ---------------------------------------------------------------------------

/**
 * Parameters for querying audit events.
 *
 * The `workspaceId` is REQUIRED for all queries — audit access is
 * workspace-scoped and MUST NOT cross workspace boundaries.
 */
export interface AuditEventFilter {
  /** REQUIRED: workspace scope (prevents cross-workspace queries). */
  workspaceId: string;
  /** Optional actor filter. */
  actorId?: string;
  /** Optional action filter. */
  action?: string;
  /** Optional resource type filter. */
  resourceType?: string;
  /** Optional outcome filter. */
  outcome?: AuditOutcome;
  /** Include events from this time onward (inclusive). */
  from?: Date;
  /** Include events up to this time (inclusive). */
  to?: Date;
  /** Maximum number of events to return (default 100, max 1000). */
  limit?: number;
  /** Cursor for pagination (the `id` of the last event from a previous page). */
  cursor?: string;
}

/**
 * Result of a paginated audit query.
 */
export interface AuditEventPage {
  /** Events in this page. */
  events: AuditEvent[];
  /** Cursor for the next page, or null if this is the last page. */
  nextCursor: string | null;
}
