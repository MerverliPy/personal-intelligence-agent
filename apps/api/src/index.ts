import { loadConfig, safeConfigForLogging } from '@pia/config';

function main(): void {
  // Validate configuration before serving work
  try {
    const config = loadConfig();
    console.log('API server starting in %s mode', config.mode);
    console.log('Configuration loaded: %s', JSON.stringify(safeConfigForLogging(config)));
  } catch (error) {
    console.error('Failed to load configuration:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
