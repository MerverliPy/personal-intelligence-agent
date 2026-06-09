import { loadConfig, safeConfigForLogging } from '@pia/config';
import { createObservability, runWithCorrelation } from '@pia/observability';

function main(): void {
  // Validate configuration before processing work
  try {
    const config = loadConfig();
    const observability = createObservability({
      enabled: true,
      logLevel: config.logging.level,
      logFormat: config.logging.format,
    });

    // Every worker job is wrapped in a correlation context
    runWithCorrelation(() => {
      observability.logger.info('Worker starting', {
        mode: config.mode,
        config: safeConfigForLogging(config),
      });
    });
  } catch (error) {
    console.error('Failed to load configuration:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
