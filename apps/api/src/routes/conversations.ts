// ---------------------------------------------------------------------------
// Conversation routes — REST + SSE streaming (P3-T05)
// ---------------------------------------------------------------------------
// Per api/openapi.yaml:
//   - POST   /conversations                              create a conversation
//   - GET    /conversations                              list conversations
//   - GET    /conversations/{conversation_id}            get a conversation
//   - POST   /conversations/{conversation_id}/messages   create message + initiate run
//   - GET    /conversations/{conversation_id}/events     SSE event stream
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { createPool } from '@pia/db';
import { createConversation, listConversations, getConversation } from '@pia/db';
import { getConversationMessages, getModelRun, getMessage } from '@pia/db';
import type { ConversationMode } from '@pia/db';
import {
  fakeModelGateway,
  fakeModelGatewayConfig,
  createOpenAIGateway,
  AssistantOrchestrator,
  type ModelGateway,
  type ModelGatewayConfig,
} from '@pia/ai';
import { loadConfig } from '@pia/config';
import { RetrievalService, fakeEmbeddingProvider, defaultFakeModelConfig } from '@pia/knowledge';
import {
  createErrorEnvelope,
  normaliseLimit,
  type Conversation,
  type ConversationPage,
  type CreateConversationRequest,
  type CreateMessageRequest,
  type Message,
  type MessagePage,
  type ModelRun,
  type ModelRunStatusApi,
} from '@pia/contracts';
import { requireAuth } from '../plugins/auth.js';
import { requireWorkspaceContext } from '../plugins/workspace-context.js';

/**
 * Maps database conversation rows to API contract Conversation objects.
 */
function toApiConversation(row: {
  id: string;
  workspaceId: string;
  projectId: string | null;
  title: string | null;
  mode: ConversationMode;
  createdAt: string;
  updatedAt: string;
}): Conversation {
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    project_id: row.projectId,
    title: row.title,
    mode: row.mode,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

/**
 * Maps database PersistedMessage rows to API contract Message objects.
 */
function toApiMessage(row: {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  createdAt: string;
}): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    created_at: row.createdAt,
  };
}

/**
 * Conversation routes.
 */
const conversationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  const pool = createPool();

  // Initialize the retrieval service
  const retrievalService = new RetrievalService({
    pool,
    embeddingProvider: fakeEmbeddingProvider,
    embeddingModelConfig: defaultFakeModelConfig(),
  });

  // Initialize the orchestrator. Selects the model gateway from MODEL_PROVIDER
  // ("fake" -> in-memory, anything else -> OpenAI-compatible adapter). The
  // adapter accepts an optional MODEL_BASE_URL override so DeepSeek (or any
  // other OpenAI-compatible provider) can be routed through the same code path.
  const { gateway, gatewayConfig } = buildGateway();

  const orchestrator = new AssistantOrchestrator({
    gateway,
    retrievalService,
    pool,
    provider: gatewayConfig.provider,
    model: gatewayConfig.name,
  });

  // -----------------------------------------------------------------------
  // POST /v1/workspaces/{workspace_id}/conversations
  // -----------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/conversations',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            project_id: { type: 'string', format: 'uuid' },
            title: { type: 'string', maxLength: 200 },
            mode: {
              type: 'string',
              enum: ['ASK', 'RESEARCH', 'ANALYZE', 'PLAN', 'EXECUTE', 'LEARN'],
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const body = request.body as CreateConversationRequest;

      const row = await createConversation(pool, ctx.workspaceId, session.userId, {
        projectId: body.project_id ?? null,
        title: body.title ?? null,
        mode: body.mode ?? 'ASK',
      });

      return reply.status(201).send(toApiConversation(row));
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/conversations
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/conversations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const reqQuery = request.query as { cursor?: string; limit?: string };
      const limit = normaliseLimit(reqQuery.limit ? parseInt(reqQuery.limit, 10) : undefined);
      const cursor = reqQuery.cursor ?? undefined;

      // listConversations uses offset-based pagination
      const offset = cursor ? parseInt(cursor, 10) : 0;

      const rows = await listConversations(pool, ctx.workspaceId, {
        limit: limit + 1,
        offset,
      });

      const items = rows.slice(0, limit).map(toApiConversation);
      const hasMore = rows.length > limit;

      const page: ConversationPage = {
        items,
        next_cursor: hasMore ? String(offset + limit) : null,
      };

      return reply.send(page);
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/conversations/{conversation_id}
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/conversations/:conversation_id',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as { conversation_id: string };

      const row = await getConversation(pool, ctx.workspaceId, params.conversation_id);
      if (!row) {
        return reply
          .status(404)
          .send(createErrorEnvelope('NOT_FOUND', 'Conversation not found.', request.id));
      }

      return reply.send(toApiConversation(row));
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/conversations/{conversation_id}/messages
  //
  // Returns all messages for a conversation in chronological order.
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/conversations/:conversation_id/messages',
    async (request: FastifyRequest, reply: FastifyReply) => {
      requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as { conversation_id: string };

      const rows = await getConversationMessages(pool, ctx.workspaceId, params.conversation_id);

      const items = rows.map(toApiMessage);
      const page: MessagePage = { items };
      return reply.send(page);
    },
  );

  // -----------------------------------------------------------------------
  // POST /v1/workspaces/{workspace_id}/conversations/{conversation_id}/messages
  //
  // Phase 1: persist user message + create model run (CREATED).
  // Returns 202 with the ModelRun resource.
  // -----------------------------------------------------------------------
  app.post(
    '/v1/workspaces/:workspace_id/conversations/:conversation_id/messages',
    {
      schema: {
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['content'],
          properties: {
            content: { type: 'string', minLength: 1, maxLength: 200000 },
            mode: {
              type: 'string',
              enum: ['ASK', 'RESEARCH', 'ANALYZE', 'PLAN', 'EXECUTE', 'LEARN'],
            },
            retrieval: {
              type: 'object',
              additionalProperties: false,
              properties: {
                enabled: { type: 'boolean' },
                source_ids: {
                  type: 'array',
                  items: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as { conversation_id: string };
      const body = request.body as CreateMessageRequest;

      // Verify conversation exists and belongs to workspace
      const conv = await getConversation(pool, ctx.workspaceId, params.conversation_id);
      if (!conv) {
        return reply
          .status(404)
          .send(createErrorEnvelope('NOT_FOUND', 'Conversation not found.', request.id));
      }

      // Phase 1: Persist user message + create run (CREATED)
      const { userMessageId, runId, createdAt } = await orchestrator.initiate({
        workspaceId: ctx.workspaceId,
        conversationId: params.conversation_id,
        userId: session.userId,
        userContent: body.content,
      });

      // Return 202 with the ModelRun resource
      const modelRun: ModelRun = {
        id: runId,
        conversation_id: params.conversation_id,
        user_message_id: userMessageId,
        assistant_message_id: null,
        status: 'CREATED' as ModelRunStatusApi,
        provider: orchestrator.provider,
        model: orchestrator.model,
        prompt_name: orchestrator.promptName,
        prompt_version: orchestrator.promptVersion,
        created_at: createdAt,
      };

      return reply.status(202).send(modelRun);
    },
  );

  // -----------------------------------------------------------------------
  // GET /v1/workspaces/{workspace_id}/conversations/{conversation_id}/events
  //
  // Phase 2: stream the full orchestration pipeline as SSE events.
  // Supports Last-Event-ID for reconnection.
  // -----------------------------------------------------------------------
  app.get(
    '/v1/workspaces/:workspace_id/conversations/:conversation_id/events',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const session = requireAuth(request);
      const ctx = await requireWorkspaceContext(request);
      const params = request.params as { conversation_id: string };
      const reqQuery = request.query as { run_id?: string };

      if (!reqQuery.run_id) {
        return reply
          .status(400)
          .send(
            createErrorEnvelope(
              'VALIDATION_ERROR',
              'run_id query parameter is required.',
              request.id,
            ),
          );
      }

      // Verify conversation exists and is authorized
      const convRow = await getConversation(pool, ctx.workspaceId, params.conversation_id);
      if (!convRow) {
        return reply
          .status(404)
          .send(createErrorEnvelope('NOT_FOUND', 'Conversation not found.', request.id));
      }

      // Look up the model run — it must exist and belong to this conversation
      const runRow = await getModelRun(pool, ctx.workspaceId, reqQuery.run_id);
      if (!runRow || runRow.conversationId !== params.conversation_id) {
        return reply
          .status(404)
          .send(createErrorEnvelope('NOT_FOUND', 'Model run not found.', request.id));
      }

      // Look up the user message to get the actual content for retrieval/context
      const msgRow = await getMessage(pool, ctx.workspaceId, runRow.userMessageId);
      const userContent = msgRow?.content ?? '';

      // Parse Last-Event-ID header for reconnection
      const lastEventIdHeader = request.headers['last-event-id'] as string | undefined;
      const lastSequence = lastEventIdHeader ? parseInt(lastEventIdHeader, 10) : 0;

      // Set SSE headers
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      // Create an AbortSignal from the request
      const abortController = new AbortController();
      const cleanup = () => abortController.abort();
      request.raw.on('close', cleanup);
      request.raw.on('error', cleanup);

      try {
        // Phase 2: Stream the full orchestration pipeline
        // PIA_DISABLE_RETRIEVAL=1 lets the assistant answer without document
        // evidence, which is useful when testing a model gateway end-to-end
        // before any documents have been ingested.
        const disableRetrieval = process.env['PIA_DISABLE_RETRIEVAL'] === '1';
        const eventGenerator = orchestrator.stream({
          workspaceId: ctx.workspaceId,
          conversationId: params.conversation_id,
          userId: session.userId,
          runId: reqQuery.run_id,
          userContent,
          mode: convRow.mode,
          signal: abortController.signal,
          ...(disableRetrieval ? { retrievalEnabled: false } : {}),
        });

        let sequence = 0;
        for await (const event of eventGenerator) {
          sequence++;
          if (sequence <= lastSequence) continue;

          const eventLine = `event: ${event.type}`;
          const dataLine = `data: ${JSON.stringify(event)}`;

          if (!reply.raw.writableEnded) {
            reply.raw.write(`${eventLine}\n${dataLine}\n\n`);
          }
        }
      } catch (err) {
        app.log.error({ err }, 'SSE stream error');
      } finally {
        if (!reply.raw.writableEnded) {
          reply.raw.end();
        }
      }
    },
  );
};

/**
 * Picks the model gateway and config based on MODEL_PROVIDER.
 *
 * - `fake` (default): in-memory canned-response gateway, no network.
 * - Anything else (`openai`, `deepseek`, etc.): OpenAI-compatible adapter.
 *   `MODEL_BASE_URL` overrides the API base URL so OpenAI-compatible
 *   providers (e.g. https://api.deepseek.com/v1) can be used directly.
 */
function buildGateway(): { gateway: ModelGateway; gatewayConfig: ModelGatewayConfig } {
  let config;
  try {
    config = loadConfig();
  } catch {
    return { gateway: fakeModelGateway, gatewayConfig: fakeModelGatewayConfig() };
  }

  if (config.model.provider === 'fake') {
    return { gateway: fakeModelGateway, gatewayConfig: fakeModelGatewayConfig() };
  }

  const gatewayConfig: ModelGatewayConfig = {
    provider: config.model.provider,
    name: config.model.name,
    apiKey: config.model.apiKey,
    maxTokens: config.model.maxTokens,
    temperature: config.model.temperature,
    timeoutMs: config.model.timeoutMs,
  };

  const baseURL = process.env['MODEL_BASE_URL'];
  const gateway = createOpenAIGateway({
    config: gatewayConfig,
    ...(baseURL ? { baseURL } : {}),
  });

  return { gateway, gatewayConfig };
}

export default conversationRoutes;
