import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { createErrorEnvelope } from '@pia/contracts';

/** Fastify's default error shape (subset). */
interface FastifyErrorLike {
  validation?: unknown;
  statusCode?: number;
  message?: string;
}

/**
 * Error-handler plugin.
 *
 * Intercepts all errors and ensures every response uses the standard
 * {@link ErrorEnvelope} format defined in the OpenAPI contract.
 *
 * - Fastify validation errors (400) become `VALIDATION_ERROR`.
 * - Unhandled server errors (500) become `INTERNAL_ERROR` and never
 *   disclose stack traces or internal state.
 * - All error responses include the `X-Request-ID` header.
 */
const errorHandlerPlugin: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.setErrorHandler(async (rawError, request, reply) => {
    const requestId = request.id;
    const error = rawError as FastifyErrorLike & Error;

    // Log the raw error for diagnostics
    // eslint-disable-next-line no-console
    console.error('[ERROR-HANDLER]', requestId, error.message, error.stack?.slice(0, 200));

    // Fastify validation errors
    if (error.validation) {
      return reply.status(400).send(
        createErrorEnvelope('VALIDATION_ERROR', error.message, requestId, {
          validation: error.validation as Record<string, unknown>,
        }),
      );
    }

    // Fastify 404 (route not found)
    if (error.statusCode === 404) {
      return reply
        .status(404)
        .send(createErrorEnvelope('NOT_FOUND', 'The requested resource was not found.', requestId));
    }

    // Explicit statusCode from the error (set by route handlers)
    const statusCode = error.statusCode ?? 500;

    const code =
      statusCode === 401
        ? 'UNAUTHORIZED'
        : statusCode === 403
          ? 'FORBIDDEN'
          : statusCode === 409
            ? 'CONFLICT'
            : statusCode === 413
              ? 'PAYLOAD_TOO_LARGE'
              : statusCode === 503
                ? 'SERVICE_UNAVAILABLE'
                : 'INTERNAL_ERROR';

    // Never leak internal error details
    const message =
      statusCode >= 500 ? 'An internal error occurred.' : error.message || 'An error occurred.';

    return reply.status(statusCode).send(createErrorEnvelope(code, message, requestId));
  });
};

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
  fastify: '5.x',
});
