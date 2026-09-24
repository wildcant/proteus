import { env } from '@env'
import localfsProvider from '../../providers/file-localfs/index.js'
import s3Provider from '../../providers/file-s3/index.js'
import type { FileModuleOptions, FileProviderConfig } from './loaders/providers.js'

/** Registers as `fs_s3_default`. Missing credentials fail at bootstrap, not at first upload. */
const s3FileProvider: FileProviderConfig = {
  resolve: s3Provider,
  id: 'default',
  options: {
    fileUrl: env.S3_FILE_URL,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    ...(env.S3_PREFIX ? { prefix: env.S3_PREFIX } : {}),
    ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
    ...(env.S3_FORCE_PATH_STYLE ? { forcePathStyle: true } : {}),
  },
}

/** Registers as `fs_localfs_local`. Writes to `{cwd}/static`, served at `/static`. */
const localFileProvider: FileProviderConfig = {
  resolve: localfsProvider,
  id: 'local',
}

/**
 * Single source of truth for which file provider is configured.
 * Used by container.ts (DI registration). The module accepts exactly one.
 *
 * Production stores uploads in S3 or R2; test writes to the local filesystem so it runs without
 * object storage. `FILE_PROVIDER` overrides that default: `.env.local` sets it to point development
 * at the compose MinIO, which workerd needs because it cannot touch the host disk, and the staging
 * restore uses it to seed images into object storage without pretending to be production.
 */
const useS3 = env.FILE_PROVIDER ? env.FILE_PROVIDER === 's3' : env.NODE_ENV === 'production'

export const fileProviderDeclarations: FileModuleOptions = {
  provider: useS3 ? s3FileProvider : localFileProvider,
}
