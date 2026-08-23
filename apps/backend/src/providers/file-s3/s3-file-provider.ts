import path from 'node:path'
import { Writable } from 'node:stream'
import type { ObjectCannedACL } from '@aws-sdk/client-s3'
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AppError, ErrorTypes } from '../../core/errors/app-error.js'
import type {
  ProviderDeleteFileDTO,
  ProviderDownloadStream,
  ProviderFileResultDTO,
  ProviderGetFileDTO,
  ProviderGetPresignedUploadUrlDTO,
  ProviderPresignedUploadUrlResult,
  ProviderUploadFileDTO,
  ProviderUploadStreamDTO,
  ProviderUploadStreamResult,
} from '../../core/types/file/mutations.js'
import { AbstractFileProviderService } from '../../core/utils/abstract-file-provider.js'
import { decodeFileContent } from '../../core/utils/decode-file-content.js'

export type S3FileProviderConfig = {
  /** Public base URL objects are served from — an S3 website endpoint, a CDN, or an R2 public bucket URL. */
  fileUrl: string
  /** AWS region, or `auto` for Cloudflare R2. */
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** Optional key namespace, e.g. `media` puts every object under `media/`. */
  prefix?: string
  /** Required for S3-compatible services such as R2; omit for AWS. */
  endpoint?: string
  /**
   * Canned ACL for uploaded objects, or `false` to omit the ACL header entirely. Defaults to
   * deriving it from the file's `access`.
   */
  acl?: ObjectCannedACL | false
}

/**
 * Normalizes a caller-supplied filename into a safe key fragment: posix slashes, no leading
 * slash, no `.`/`..` segments. Without this a filename walks out of the configured prefix — S3
 * stores `media/../x.png` literally, but browsers and CDNs normalize it away at the edge.
 */
function sanitizeFilePath(filePath: string): string {
  const cleanPath = filePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return path.posix
    .normalize(cleanPath)
    .split('/')
    .filter((segment) => segment !== '..' && segment !== '.')
    .join('/')
}

const REQUIRED_CONFIG_KEYS = ['fileUrl', 'region', 'bucket', 'accessKeyId', 'secretAccessKey'] as const

const PRESIGNED_URL_TTL_SECONDS = 60 * 60

/** S3 rejects a DeleteObjects request carrying more than 1000 keys. */
const DELETE_BATCH_LIMIT = 1000

export class S3FileProvider extends AbstractFileProviderService<S3FileProviderConfig> {
  static identifier = 's3'

  private client: S3Client
  private bucket: string
  private fileUrl: string
  private prefix: string
  private acl: ObjectCannedACL | false | undefined

  constructor(container: Record<string, unknown>, config: S3FileProviderConfig) {
    super(container, config)

    // Credentials are required rather than discovered: the SDK's default chain reads instance
    // metadata and the shared credentials file, neither of which exists on Workers.
    for (const key of REQUIRED_CONFIG_KEYS) {
      if (!config[key]) {
        throw new AppError({
          type: ErrorTypes.INVALID_DATA,
          message: `S3 file provider requires "${key}" in its configuration.`,
        })
      }
    }

    this.bucket = config.bucket
    this.fileUrl = config.fileUrl.replace(/\/+$/, '')
    this.prefix = config.prefix?.replace(/^\/+/, '').replace(/\/+$/, '') ?? ''
    this.acl = config.acl

    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
    })
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sanitizeFilename(filename: string): string {
    const sanitized = sanitizeFilePath(filename)

    if (!sanitized) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: `Invalid filename: "${filename}"`,
      })
    }

    return sanitized
  }

  /** Prefixes a caller-supplied filename and uses it as the object key verbatim. */
  private buildFileKey(filename: string): string {
    return [this.prefix, this.sanitizeFilename(filename)].filter(Boolean).join('/')
  }

  /**
   * Like `buildFileKey`, but makes the key unique so two uploads of the same filename don't
   * overwrite each other. Used where the server holds the bytes. Presigned uploads deliberately
   * keep the caller's key, because the module reports `fileKey` back as the filename it was
   * given — a generated key there would name an object the caller can never address.
   */
  private buildUniqueFileKey(filename: string): string {
    const parsed = path.posix.parse(this.sanitizeFilename(filename))
    return [this.prefix, parsed.dir, `${Date.now()}-${parsed.base}`].filter(Boolean).join('/')
  }

  /**
   * Object keys are stored raw — S3 signs the raw key — so only the browser-facing URL is
   * escaped, per path segment so the key's own separators survive.
   */
  private buildFileUrl(fileKey: string): string {
    const encodedKey = fileKey
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')
    return `${this.fileUrl}/${encodedKey}`
  }

  /**
   * Buckets with Object Ownership set to BucketOwnerEnforced — the default for AWS buckets
   * created since April 2023 — reject any PutObject carrying an ACL, as do S3-compatible
   * services that don't implement ACLs. Configure `acl: false` to omit the header for those.
   */
  private resolveAcl(access: 'public' | 'private'): ObjectCannedACL | undefined {
    if (this.acl === false) {
      return undefined
    }

    if (this.acl) {
      return this.acl
    }

    return access === 'public' ? 'public-read' : 'private'
  }

  private async getObjectBody(fileKey: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: fileKey }))

    if (!response.Body) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `File with key ${fileKey} not found`,
      })
    }

    return response.Body
  }

  // ---------------------------------------------------------------------------
  // IFileProvider
  // ---------------------------------------------------------------------------

  async upload(file: ProviderUploadFileDTO): Promise<ProviderFileResultDTO> {
    const fileKey = this.buildUniqueFileKey(file.filename)

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: fileKey,
        Body: decodeFileContent(file.content, file.mimeType),
        ContentType: file.mimeType,
        ACL: this.resolveAcl(file.access),
      }),
    )

    return { url: this.buildFileUrl(fileKey), key: fileKey }
  }

  /** Accepts a batch so callers can delete many objects in one round-trip per 1000 keys. */
  async delete(file: ProviderDeleteFileDTO | ProviderDeleteFileDTO[]): Promise<void> {
    const keys = (Array.isArray(file) ? file : [file]).map((entry) => entry.fileKey)

    const [onlyKey] = keys
    if (!onlyKey) {
      return
    }

    if (keys.length === 1) {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: onlyKey }))
      return
    }

    const batches: string[][] = []
    for (let index = 0; index < keys.length; index += DELETE_BATCH_LIMIT) {
      batches.push(keys.slice(index, index + DELETE_BATCH_LIMIT))
    }

    await Promise.all(
      batches.map((batch) =>
        this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: batch.map((key) => ({ Key: key })) },
          }),
        ),
      ),
    )
  }

  async getPresignedDownloadUrl(fileData: ProviderGetFileDTO): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: fileData.fileKey }), {
      expiresIn: PRESIGNED_URL_TTL_SECONDS,
    })
  }

  async getPresignedUploadUrl(data: ProviderGetPresignedUploadUrlDTO): Promise<ProviderPresignedUploadUrlResult> {
    const fileKey = this.buildFileKey(data.filename)

    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: fileKey, ACL: this.resolveAcl(data.access) }),
      { expiresIn: PRESIGNED_URL_TTL_SECONDS },
    )

    return { url, fields: { key: fileKey } }
  }

  async getDownloadStream(fileData: ProviderGetFileDTO): Promise<ProviderDownloadStream> {
    const body = await this.getObjectBody(fileData.fileKey)
    return body as ProviderDownloadStream
  }

  async getAsBuffer(fileData: ProviderGetFileDTO): Promise<Buffer> {
    const body = await this.getObjectBody(fileData.fileKey)
    return Buffer.from(await body.transformToByteArray())
  }

  async getUploadStream(data: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult> {
    const fileKey = this.buildUniqueFileKey(data.filename)
    const chunks: Buffer[] = []

    // PutObject needs a known content length, so the bytes are held until the caller ends the
    // stream. Doing the upload in `_final` means `finish` fires only once S3 has accepted it.
    const writeStream = new Writable({
      write: (chunk: Buffer, _encoding, callback) => {
        chunks.push(chunk)
        callback()
      },
      final: (callback) => {
        this.client
          .send(
            new PutObjectCommand({
              Bucket: this.bucket,
              Key: fileKey,
              Body: Buffer.concat(chunks),
              ContentType: data.mimeType,
              ACL: this.resolveAcl(data.access),
            }),
          )
          .then(() => callback())
          .catch((error: Error) => callback(error))
      },
    })

    return { writeStream, url: this.buildFileUrl(fileKey) }
  }
}
