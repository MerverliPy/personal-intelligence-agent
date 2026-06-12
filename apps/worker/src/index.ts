import { loadConfig, safeConfigForLogging } from '@pia/config';
import { createObservability, runWithCorrelation } from '@pia/observability';
import { createPool } from '@pia/db';
import { JobConsumer } from '@pia/jobs';
import type { JobHandler, JobContext, OutboxRecord } from '@pia/jobs';
import {
  IngestionWorkflowHandler,
  noopExtractionStage,
  noopChunkingStage,
  createEmbeddingStage,
  createFakeEmbeddingProvider,
} from '@pia/knowledge';

/**
 * Handler for `document.upload.completed` events.
 *
 * Downstream processing after upload completion (audit logging,
 * notifications, etc.) can be added here. Currently a no-op placeholder.
 */
const uploadCompletedHandler: JobHandler = {
  eventType: 'document.upload.completed',

  async handle(record: OutboxRecord, context: JobContext): Promise<void> {
    void record;
    void context;
  },
};

function main(): void {
  try {
    const config = loadConfig();
    const observability = createObservability({
      enabled: true,
      logLevel: config.logging.level,
      logFormat: config.logging.format,
    });

    runWithCorrelation(() => {
      const logger = observability.logger;
      const pool = createPool();

      logger.info('Worker starting', {
        mode: config.mode,
        config: safeConfigForLogging(config),
      });

      const consumer = new JobConsumer(pool, logger, {
        workerIdentity: `worker-${process.pid}`,
      });

      // Register handlers
      consumer.register(uploadCompletedHandler);

      // Ingestion workflow: durable, idempotent pipeline with resumable stages.
      // Extraction and chunking stages use no-op implementations until
      // P2-T04 (parsers) and P2-T05 (chunking). Embedding uses the real
      // embedding gateway (P2-T06) with configurable provider.
      const embeddingStage = createEmbeddingStage({
        pool,
        provider: createFakeEmbeddingProvider(),
        modelConfig: {
          provider: config.embedding.provider,
          model: config.embedding.model,
          dimensions: config.embedding.dimensions,
          version: config.embedding.version,
        },
        batchSize: config.embedding.batchSize,
      });

      const ingestionHandler = new IngestionWorkflowHandler({
        pool,
        logger,
        stages: {
          extraction: noopExtractionStage,
          chunking: noopChunkingStage,
          embedding: embeddingStage,
        },
      });
      consumer.register(ingestionHandler);

      // TODO: Register additional handlers as they are implemented:
      //   consumer.register(evaluationHandler);
      //   consumer.register(memoryHandler);

      consumer.start();

      // Graceful shutdown
      const shutdown = (signal: string) => {
        logger.info('Worker received signal', { signal });
        consumer.stop();
        void pool.end().then(() => {
          process.exit(0);
        });
      };

      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));

      logger.info('Worker ready and polling for jobs', {
        workerIdentity: `worker-${process.pid}`,
      });
    });
  } catch (error) {
    console.error('Failed to start worker:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
