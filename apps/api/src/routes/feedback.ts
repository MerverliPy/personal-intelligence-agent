// ---------------------------------------------------------------------------
// Feedback routes (P3-T08)
// ---------------------------------------------------------------------------
// Per FR-FBK-001..004:
//   - POST /messages/{message_id}/feedback  submit feedback
//   - GET  /messages/{message_id}/feedback  list feedback for a message
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { createPool, createFeedback, getFeedbackForMessage } from '@pia/db';
import type { CreateFeedbackRequest } from '@pia/contracts';
import type { FailureClass } from '@pia/domain';
import { isValidFailureClass } from '@pia/domain';
import { requireAuth } from '../plugins/auth.js';
import { requireWorkspaceContext } from '../plugins/workspace-context.js';
import { auditEventFromRequest } from '../plugins/audit.js';

const FEEDBACK_CATEGORIES = [
  'POSITIVE',
  'NEGATIVE',
  'INCORRECT',
  'INCOMPLETE',
  'CITATION_ISSUE',
  'STYLE_ISSUE',
  'UNSAFE',
];

const feedbackRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const pool = createPool();

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
            category: { type: 'string', enum: FEEDBACK_CATEGORIES },
            model_run_id: { type: 'string', format: 'uuid' },
            correction: { type: 'string' },
            notes: { type: 'string' },
            suggested_failure_class: { type: 'string' },
            classification_confidence: {
              type: 'number',
              minimum: 0,
              maximum: 1,
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

      if (body.suggested_failure_class && !isValidFailureClass(body.suggested_failure_class)) {
        return reply.status(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid failure classification: ${body.suggested_failure_class}`,
            request_id: request.id,
          },
        });
      }

      const row = await createFeedback(pool, {
        workspaceId: ctx.workspaceId,
        messageId: message_id,
        modelRunId: body.model_run_id ?? null,
        submittedBy: session.userId,
        category: body.category,
        correction: body.correction ?? null,
        notes: body.notes ?? null,
        suggestedFailureClass: (body.suggested_failure_class as FailureClass) ?? null,
        classificationConfidence: body.classification_confidence ?? null,
      });

      // Audit log the feedback submission
      if (app.auditWriter) {
        app.auditWriter.write(
          auditEventFromRequest(request, 'feedback.create', 'success', {
            workspaceId: ctx.workspaceId,
            resourceType: 'feedback',
            resourceId: row.id,
            metadata: {
              messageId: message_id,
              category: body.category,
              hasCorrection: body.correction != null,
              hasFailureClass: body.suggested_failure_class != null,
            },
          }),
        );
      }

      return reply.status(201).send({
        id: row.id,
        workspace_id: row.workspaceId,
        message_id: row.messageId,
        model_run_id: row.modelRunId,
        submitted_by: row.submittedBy,
        category: row.category,
        correction: row.correction,
        notes: row.notes,
        suggested_failure_class: row.suggestedFailureClass,
        classification_confidence: row.classificationConfidence,
        created_at: row.createdAt,
      });
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
        items: rows.map((row) => ({
          id: row.id,
          workspace_id: row.workspaceId,
          message_id: row.messageId,
          model_run_id: row.modelRunId,
          submitted_by: row.submittedBy,
          category: row.category,
          correction: row.correction,
          notes: row.notes,
          suggested_failure_class: row.suggestedFailureClass,
          classification_confidence: row.classificationConfidence,
          created_at: row.createdAt,
        })),
      });
    },
  );
};

export default feedbackRoutes;
