export type {
  StorageConfig,
  StorageProvider,
  UploadMetadata,
  UploadTarget,
  UploadCompletion,
  DownloadUrl,
} from './types.js';

export { createS3StorageProvider } from './s3-adapter.js';

export { createLocalStorageProvider, simulateUpload } from './local-adapter.js';
export type { StoredObject } from './local-adapter.js';
