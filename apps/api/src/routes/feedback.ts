// ---------------------------------------------------------------------------
// Feedback routes (P3-T08)
// ---------------------------------------------------------------------------
// Per FR-FBK-001..004:
//   - POST   /v1/workspaces/{wid}/messages/{mid}/feedback         submit
//   - GET    /v1/workspaces/{wid}/messages/{mid}/feedback         list
//   - GET    /v1/workspaces/{wid}/feedback/{fid}                  read one
//   - GET    /v1/workspaces/{wid}/messages/{mid}/feedback/suggestion  latest suggestion
//
// SECURITY:
//   - Free-text `correction` and `notes` are length-capped at the API
//     boundary (default 4096 bytes, configurable via env). Oversized
//     text is rejected with 413 PAYLOAD_TOO_LARGE.
//   - Free-text is stored verbatim (plain text). The render layer is
//     responsible for HTML escaping. The classifier ignores the text
//     contents and is a pure function of the category.
//   - All write/read paths are workspace-scoped via the existing
//     auth + workspace-context plugins.
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { createPool, getFeedback, getFeedbackForMessage } from '@pia/db';
import { submitFeedback } from '@pia/ai';
import { isValidFailureClass } from '@pia/domain';
import type { CreateFeedbackRequest, FeedbackSubmission } from '@pia/contracts';
import { FEEDBACK_CATEGORIES } from '@pia/ai';
import { requireAuth } from '../plugins/auth.js';
import { requireWorkspaceContext } from '../plugins/workspace-context.js';
import { auditEventFromRequest } from '../plugins/audit.js';

/**
 * Default maximum length, in bytes, of free-text feedback fields.
 * Override via `FEEDBACK_TEXT_MAX_BYTES` env (positive integer).
 */
const DEFAULT_FEEDBACK_TEXT_MAX_BYTES = 4096;

function feedbackTextMaxBytes(): number {
  const raw = process.env['FEEDBACK_TEXT_MAX_BYTES'];
  if (!raw) return DEFAULT_FEEDBACK_TEXT_MAX_BYTES;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_FEEDBACK_TEXT_MAX_BYTES;
  return parsed;
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

const FEEDBACK_CATEGORY_SET = new Set<string>(FEEDBACK_CATEGORIES);

function isFeedbackCategoryString(value: string): boolean {
  return FEEDBACK_CATEGORY_SET.has(value);
}

function toFeedbackResponse(row: {
  id: string;
  workspaceId: string;
  messageId: string;
  modelRunId: string | null;
  submittedBy: string;
  category: string;
  correction: string | null;
  notes: string | null;
  suggestedFailureClass: string | null;
  classificationConfidence: number | null;
  retrievalTraceIds: string[];
  createdAt: string;
}): Omit<FeedbackSubmission, 'suggestion'> {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    message_id: row.messageId,
    model_run_id: row.modelRunId,
    submitted_by: row.submittedBy,
    category: row.category as FeedbackSubmission['category'],
    correction: row.correction,
    notes: row.notes,
    suggested_failure_class: row.suggestedFailureClass,
    classification_confidence: row.classificationConfidence,
    retrieval_trace_ids: row.retrievalTraceIds,
    created_at: row.createdAt,
  };
}

const feedbackRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const pool = createPool();
  const maxBytes = feedbackTextMaxBytes();

  // -----------------------------------------------------------------------
  // POST /v1/workspaces/{workspace_id}/messages/{message_id}/feedback
  // -----------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/messages/:message_id/feedback',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['category'],
          properties: {
            category: { type: 'string' },
            model_run_id: { type: 'string', format: 'uuid' },
            correction: { type: 'string' },
            notes: { type: 'string' },
            suggested_failure_class: { type: 'string' },
            classification_confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
            },
            retrieval_trace_ids: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
              maxItems: 64,
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const { message_id } = request.params as { message_id: string };
      const body = request.body as CreateFeedbackRequest;

      if (!isFeedbackCategoryString(body.category)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid feedback category: ${body.category}`,
            request_id: request.id,
          },
        });
      }

      if (body.suggested_failure_class && !isValidFailureClass(body.suggested_failure_class)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid failure classification: ${body.suggested_failure_class}`,
            request_id: request.id,
          },
        });
      }

      // Free-text length cap. Stored verbatim; render layer escapes.
      if (body.correction != null && byteLength(body.correction) > maxBytes) {
        return reply.status(413).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `correction exceeds ${maxBytes} bytes`,
            request_id: request.id,
          },
        });
      }
      if (body.notes != null && byteLength(body.notes) > maxBytes) {
        return reply.status(413).send({
          error: {
            code: 'PAYLOAD_TOO_LARGE',
            message: `notes exceeds ${maxBytes} bytes`,
            request_id: request.id,
          },
        });
      }

      const result = await submitFeedback(pool, {
        workspaceId: ctx.workspaceId,
        messageId: message_id,
        submittedBy: session.userId,
        category: body.category,
        correction: body.correction ?? null,
        notes: body.notes ?? null,
        modelRunId: body.model_run_id ?? null,
        suggestedFailureClass: body.suggested_failure_class
          ? (body.suggested_failure_class as Parameters<
              typeof submitFeedback
            >[1]['suggestedFailureClass'])
          : null,
        classificationConfidence: body.classification_confidence ?? null,
        retrievalTraceIds: body.retrieval_trace_ids ?? [],
      });

      // Audit log the feedback submission
      if (app.auditWriter) {
        app.auditWriter.write(
          auditEventFromRequest(request, 'feedback.create', 'success', {
            workspaceId: ctx.workspaceId,
            resourceType: 'feedback',
            resourceId: result.row.id,
            metadata: {
              messageId: message_id,
              category: body.category,
              hasCorrection: body.correction != null,
              hasFailureClass: body.suggested_failure_class != null,
              hasSuggestion: result.suggestion.category !== null,
              traceCount: (body.retrieval_trace_ids ?? []).length,
            },
          }),
        );
      }

      const response: FeedbackSubmission = {
        ...toFeedbackResponse(result.row),
        suggestion: {
          category: result.suggestion.category,
          confidence: result.suggestion.confidence,
          rationale: result.suggestion.rationale,
        },
      };
      return reply.status(201).send(response);
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/messages/{message_id}/feedback
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/messages/:message_id/feedback',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const { message_id } = request.params as { message_id: string };

      const rows = await getFeedbackForMessage(pool, ctx.workspaceId, message_id);

      return reply.send({
        items: rows.map((row) => toFeedbackResponse(row)),
      });
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/feedback/{feedback_id}
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/feedback/:feedback_id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const { feedback_id } = request.params as { feedback_id: string };

      const row = await getFeedback(pool, ctx.workspaceId, feedback_id);
      if (!row) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Feedback not found.',
            request_id: request.id,
          },
        });
      }

      const response: FeedbackSubmission = {
        ...toFeedbackResponse(row),
        suggestion: {
          category: row.suggestedFailureClass,
          confidence: row.classificationConfidence ?? 0,
          rationale: row.suggestedFailureClass
            ? 'Stored suggestion from classifier.'
            : 'No suggestion stored.',
        },
      };
      return reply.send(response);
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/messages/{message_id}/feedback/suggestion
  //
  // Returns the most recent classifier suggestion for the message.
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/messages/:message_id/feedback/suggestion',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const { message_id } = request.params as { message_id: string };

      const rows = await getFeedbackForMessage(pool, ctx.workspaceId, message_id);
      const latest = rows[0] ?? null;
      if (!latest) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'No feedback for message.',
            request_id: request.id,
          },
        });
      }
      return reply.send({
        feedback_id: latest.id,
        category: latest.category,
        suggestion: {
          category: latest.suggestedFailureClass,
          confidence: latest.classificationConfidence ?? 0,
          rationale: latest.suggestedFailureClass
            ? 'Stored suggestion from classifier.'
            : 'No suggestion stored.',
        },
      });
    },
  );
};

export default feedbackRoutes;
