import { test } from '@tests/setup/test-extend.js'
import { vi } from 'vitest'
import { ErrorTypes } from '../../../core/errors/app-error.js'
import { S3FileProvider } from '../s3-file-provider.js'

type CommandRecord = { name: string; input: Record<string, unknown> }

/** Reads `Delete.Objects` off a DeleteObjectsCommand without naming S3's PascalCase wire shape in a type. */
function deletedObjects(command: CommandRecord | undefined): Record<string, unknown>[] {
  const request = command?.input.Delete as Record<string, unknown> | undefined
  return (request?.Objects as Record<string, unknown>[] | undefined) ?? []
}

/**
 * A minimal in-memory stand-in for S3. Keeping real object bytes in `storage` lets the
 * upload/download tests assert a genuine round-trip instead of only inspecting command inputs.
 */
const s3 = vi.hoisted(() => ({
  clientConfigs: [] as Record<string, unknown>[],
  sent: [] as CommandRecord[],
  presigned: [] as (CommandRecord & { expiresIn?: number })[],
  storage: new Map<string, Buffer>(),
}))

vi.mock('@aws-sdk/client-s3', () => {
  class S3Command {
    static commandName = 'Command'
    input: Record<string, unknown>

    constructor(input: Record<string, unknown>) {
      this.input = input
    }

    get name(): string {
      return (this.constructor as typeof S3Command).commandName
    }
  }

  class PutObjectCommand extends S3Command {
    static commandName = 'PutObjectCommand'
  }
  class GetObjectCommand extends S3Command {
    static commandName = 'GetObjectCommand'
  }
  class DeleteObjectCommand extends S3Command {
    static commandName = 'DeleteObjectCommand'
  }
  class DeleteObjectsCommand extends S3Command {
    static commandName = 'DeleteObjectsCommand'
  }

  class S3Client {
    constructor(config: Record<string, unknown>) {
      s3.clientConfigs.push(config)
    }

    async send(command: S3Command): Promise<Record<string, unknown>> {
      s3.sent.push({ name: command.name, input: command.input })

      if (command.name === 'PutObjectCommand') {
        s3.storage.set(String(command.input.Key), Buffer.from(command.input.Body as Uint8Array))
        return {}
      }

      if (command.name === 'GetObjectCommand') {
        const stored = s3.storage.get(String(command.input.Key))
        if (!stored) {
          const error = new Error('The specified key does not exist.')
          error.name = 'NoSuchKey'
          throw error
        }
        return {
          Body: {
            async *[Symbol.asyncIterator]() {
              yield stored
            },
            transformToByteArray: async () => new Uint8Array(stored),
          },
        }
      }

      if (command.name === 'DeleteObjectCommand') {
        s3.storage.delete(String(command.input.Key))
        return {}
      }

      if (command.name === 'DeleteObjectsCommand') {
        for (const object of deletedObjects(command)) {
          s3.storage.delete(String(object.Key))
        }
        return {}
      }

      throw new Error(`Unhandled command: ${command.name}`)
    }
  }

  return { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand }
})

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: async (
    _client: unknown,
    command: { name: string; input: Record<string, unknown> },
    options?: { expiresIn?: number },
  ) => {
    s3.presigned.push({ name: command.name, input: command.input, expiresIn: options?.expiresIn })
    return `https://signed.example.com/${command.input.Key}?expiresIn=${options?.expiresIn}`
  },
}))

const baseConfig = {
  fileUrl: 'https://cdn.example.com',
  region: 'us-east-1',
  bucket: 'proteus-uploads',
  accessKeyId: 'AKIAEXAMPLE',
  secretAccessKey: 'secret',
}

function createProvider(overrides: Record<string, unknown> = {}) {
  return new S3FileProvider({}, { ...baseConfig, ...overrides })
}

const helloBase64 = Buffer.from('hello world').toString('base64')

function lastCommand(name: string): CommandRecord {
  const found = [...s3.sent].reverse().find((command) => command.name === name)
  if (!found) {
    throw new Error(`No ${name} was sent`)
  }
  return found
}

test.beforeEach(() => {
  s3.clientConfigs.length = 0
  s3.sent.length = 0
  s3.presigned.length = 0
  s3.storage.clear()
})

test.describe('S3FileProvider', () => {
  test('identifier is "s3"', ({ expect }) => {
    expect(S3FileProvider.identifier).toBe('s3')
  })

  // ---------------------------------------------------------------------------
  // client configuration
  // ---------------------------------------------------------------------------

  test.describe('client configuration', () => {
    test('passes explicit credentials and region, with no endpoint for AWS', ({ expect }) => {
      createProvider()

      expect(s3.clientConfigs).toHaveLength(1)
      expect(s3.clientConfigs[0]).toEqual({
        region: 'us-east-1',
        credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' },
      })
    })

    test('passes region "auto" and a custom endpoint for R2', ({ expect }) => {
      createProvider({ region: 'auto', endpoint: 'https://account.r2.cloudflarestorage.com' })

      expect(s3.clientConfigs[0]).toEqual({
        region: 'auto',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' },
      })
    })

    test('throws when accessKeyId is missing', ({ expect }) => {
      let error: unknown
      try {
        createProvider({ accessKeyId: undefined })
      } catch (thrown) {
        error = thrown
      }

      expect((error as { type?: string }).type).toBe(ErrorTypes.INVALID_DATA)
      expect((error as Error).message).toContain('accessKeyId')
    })

    test('throws when secretAccessKey is missing', ({ expect }) => {
      let error: unknown
      try {
        createProvider({ secretAccessKey: undefined })
      } catch (thrown) {
        error = thrown
      }

      expect((error as { type?: string }).type).toBe(ErrorTypes.INVALID_DATA)
      expect((error as Error).message).toContain('secretAccessKey')
    })

    test('throws when bucket is missing', ({ expect }) => {
      let error: unknown
      try {
        createProvider({ bucket: undefined })
      } catch (thrown) {
        error = thrown
      }

      expect((error as { type?: string }).type).toBe(ErrorTypes.INVALID_DATA)
      expect((error as Error).message).toContain('bucket')
    })
  })

  // ---------------------------------------------------------------------------
  // upload
  // ---------------------------------------------------------------------------

  test.describe('upload', () => {
    test('sets ACL "public-read" for public access', async ({ expect }) => {
      const provider = createProvider()

      await provider.upload({
        filename: 'logo.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      const put = lastCommand('PutObjectCommand')
      expect(put.input.ACL).toBe('public-read')
      expect(put.input.Bucket).toBe('proteus-uploads')
      expect(put.input.ContentType).toBe('image/png')
    })

    test('sets ACL "private" for private access', async ({ expect }) => {
      const provider = createProvider()

      await provider.upload({
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        content: helloBase64,
        access: 'private',
      })

      expect(lastCommand('PutObjectCommand').input.ACL).toBe('private')
    })

    test('returns a key derived from the filename and the public file URL', async ({ expect }) => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'logo.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      expect(result.key).toMatch(/^\d+-logo\.png$/)
      expect(result.url).toBe(`https://cdn.example.com/${result.key}`)
      expect(lastCommand('PutObjectCommand').input.Key).toBe(result.key)
    })

    test('applies the configured prefix to the key', async ({ expect }) => {
      const provider = createProvider({ prefix: 'media' })

      const result = await provider.upload({
        filename: 'logo.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      expect(result.key).toMatch(/^media\/\d+-logo\.png$/)
      expect(result.url).toBe(`https://cdn.example.com/${result.key}`)
    })

    test('keeps directories from the filename inside the key', async ({ expect }) => {
      const provider = createProvider({ prefix: 'media' })

      const result = await provider.upload({
        filename: 'products/thumbs/logo.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      expect(result.key).toMatch(/^media\/products\/thumbs\/\d+-logo\.png$/)
    })

    test('round-trips binary content through base64', async ({ expect }) => {
      const provider = createProvider()
      const binary = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46])

      const result = await provider.upload({
        filename: 'photo.jpg',
        mimeType: 'image/jpeg',
        content: binary.toString('base64'),
        access: 'public',
      })

      const buffer = await provider.getAsBuffer({ fileKey: result.key })
      expect(Buffer.compare(buffer, binary)).toBe(0)
    })

    test('decodes non-base64 text content as UTF-8', async ({ expect }) => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'data.json',
        mimeType: 'application/json',
        content: '{"key": "value"}',
        access: 'public',
      })

      const buffer = await provider.getAsBuffer({ fileKey: result.key })
      expect(buffer.toString('utf-8')).toBe('{"key": "value"}')
    })
  })

  // ---------------------------------------------------------------------------
  // URL encoding
  // ---------------------------------------------------------------------------

  test.describe('url encoding', () => {
    test('percent-encodes special characters in the file URL but not the key', async ({ expect }) => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'my file (1)+&.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      // The S3 object key stays raw — only the URL is encoded.
      expect(result.key).toMatch(/^\d+-my file \(1\)\+&\.png$/)
      expect(lastCommand('PutObjectCommand').input.Key).toBe(result.key)

      expect(result.url).toContain('%20')
      expect(result.url).toContain('%2B')
      expect(result.url).toContain('%26')
      expect(result.url).not.toContain(' ')
    })

    test('leaves path separators intact while encoding each segment', async ({ expect }) => {
      const provider = createProvider({ prefix: 'my media' })

      const result = await provider.upload({
        filename: 'a b/c d/e f.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      const encodedPath = result.url.replace('https://cdn.example.com/', '')
      expect(encodedPath.split('/')).toHaveLength(4)
      expect(encodedPath.startsWith('my%20media/a%20b/c%20d/')).toBe(true)
      expect(decodeURIComponent(encodedPath)).toBe(result.key)
    })
  })

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  test.describe('delete', () => {
    test('deletes a single file with DeleteObjectCommand', async ({ expect }) => {
      const provider = createProvider()
      s3.storage.set('keep.png', Buffer.from('keep'))
      s3.storage.set('drop.png', Buffer.from('drop'))

      await provider.delete({ fileKey: 'drop.png' })

      const command = lastCommand('DeleteObjectCommand')
      expect(command.input).toEqual({ Bucket: 'proteus-uploads', Key: 'drop.png' })
      expect(s3.storage.has('drop.png')).toBe(false)
      expect(s3.storage.has('keep.png')).toBe(true)
    })

    test('deletes a batch with a single DeleteObjectsCommand', async ({ expect }) => {
      const provider = createProvider()
      s3.storage.set('keep.png', Buffer.from('keep'))
      s3.storage.set('a.png', Buffer.from('a'))
      s3.storage.set('b.png', Buffer.from('b'))

      await provider.delete([{ fileKey: 'a.png' }, { fileKey: 'b.png' }])

      const command = lastCommand('DeleteObjectsCommand')
      expect(command.input).toEqual({
        Bucket: 'proteus-uploads',
        Delete: { Objects: [{ Key: 'a.png' }, { Key: 'b.png' }] },
      })
      expect(s3.storage.has('a.png')).toBe(false)
      expect(s3.storage.has('b.png')).toBe(false)
      expect(s3.storage.has('keep.png')).toBe(true)
    })

    test('chunks batches larger than the 1000-key S3 limit', async ({ expect }) => {
      const provider = createProvider()
      const files = Array.from({ length: 1001 }, (_, index) => ({ fileKey: `file-${index}.png` }))
      for (const file of files) {
        s3.storage.set(file.fileKey, Buffer.from('x'))
      }

      await provider.delete(files)

      const batches = s3.sent.filter((command) => command.name === 'DeleteObjectsCommand')
      expect(batches).toHaveLength(2)
      expect(deletedObjects(batches[0])).toHaveLength(1000)
      expect(deletedObjects(batches[1])).toHaveLength(1)
      expect(s3.storage.size).toBe(0)
    })

    test('sends nothing for an empty batch', async ({ expect }) => {
      const provider = createProvider()

      await provider.delete([])

      expect(s3.sent).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // presigned URLs
  // ---------------------------------------------------------------------------

  test.describe('getPresignedDownloadUrl', () => {
    test('signs a GET for the requested key', async ({ expect }) => {
      const provider = createProvider()

      const url = await provider.getPresignedDownloadUrl({ fileKey: 'private/report.pdf' })

      expect(s3.presigned).toHaveLength(1)
      expect(s3.presigned[0]?.name).toBe('GetObjectCommand')
      expect(s3.presigned[0]?.input).toEqual({ Bucket: 'proteus-uploads', Key: 'private/report.pdf' })
      expect(s3.presigned[0]?.expiresIn).toBeGreaterThan(0)
      expect(url).toContain('private/report.pdf')
    })
  })

  test.describe('getPresignedUploadUrl', () => {
    test('signs a PUT for the key and returns it in fields', async ({ expect }) => {
      const provider = createProvider({ prefix: 'media' })

      const result = await provider.getPresignedUploadUrl({ filename: 'upload.png', access: 'public' })

      expect(s3.presigned).toHaveLength(1)
      expect(s3.presigned[0]?.name).toBe('PutObjectCommand')

      const signedInput = s3.presigned[0]?.input ?? {}
      expect(signedInput.Bucket).toBe('proteus-uploads')
      expect(signedInput.ACL).toBe('public-read')

      expect(result.fields.key).toBe(signedInput.Key)
      expect(result.url).toContain(String(signedInput.Key))
    })

    // The module reports `fileKey` back to the caller as the filename it was given, so a key
    // generated here would sign a URL for an object the caller can never address afterwards.
    test("signs the caller's filename verbatim rather than generating a unique key", async ({ expect }) => {
      const provider = createProvider({ prefix: 'media' })

      const result = await provider.getPresignedUploadUrl({ filename: 'upload.png', access: 'public' })

      expect(s3.presigned[0]?.input.Key).toBe('media/upload.png')
      expect(result.fields.key).toBe('media/upload.png')
    })

    test('signs without a prefix when none is configured', async ({ expect }) => {
      const provider = createProvider()

      const result = await provider.getPresignedUploadUrl({ filename: 'nested/upload.png', access: 'public' })

      expect(result.fields.key).toBe('nested/upload.png')
    })

    test('signs a private PUT with the private ACL', async ({ expect }) => {
      const provider = createProvider()

      await provider.getPresignedUploadUrl({ filename: 'secret.pdf', access: 'private' })

      expect(s3.presigned[0]?.input.ACL).toBe('private')
    })
  })

  // ---------------------------------------------------------------------------
  // reads
  // ---------------------------------------------------------------------------

  test.describe('getDownloadStream', () => {
    test('streams the stored object', async ({ expect }) => {
      const provider = createProvider()
      const result = await provider.upload({
        filename: 'stream.txt',
        mimeType: 'text/plain',
        content: helloBase64,
        access: 'public',
      })

      const stream = await provider.getDownloadStream({ fileKey: result.key })
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }

      expect(Buffer.concat(chunks).toString('utf-8')).toBe('hello world')
    })

    test('propagates the SDK error when the object is missing', async ({ expect }) => {
      const provider = createProvider()

      const error = await provider.getDownloadStream({ fileKey: 'missing.txt' }).catch((e) => e)

      expect(error.name).toBe('NoSuchKey')
    })
  })

  test.describe('getAsBuffer', () => {
    test('returns the stored object as a buffer', async ({ expect }) => {
      const provider = createProvider()
      const result = await provider.upload({
        filename: 'buffer.txt',
        mimeType: 'text/plain',
        content: helloBase64,
        access: 'public',
      })

      const buffer = await provider.getAsBuffer({ fileKey: result.key })
      expect(buffer.toString('utf-8')).toBe('hello world')
    })
  })

  // ---------------------------------------------------------------------------
  // acl configuration
  // ---------------------------------------------------------------------------

  test.describe('acl configuration', () => {
    test('omits the ACL header entirely when acl is false', async ({ expect }) => {
      const provider = createProvider({ acl: false })

      await provider.upload({
        filename: 'logo.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      const put = lastCommand('PutObjectCommand')
      expect(put.input.ACL).toBeUndefined()
      expect('ACL' in put.input).toBe(true)
    })

    test('omits the ACL header on presigned uploads when acl is false', async ({ expect }) => {
      const provider = createProvider({ acl: false })

      await provider.getPresignedUploadUrl({ filename: 'upload.png', access: 'public' })

      expect(s3.presigned[0]?.input.ACL).toBeUndefined()
    })

    test('omits the ACL header on upload streams when acl is false', async ({ expect }) => {
      const provider = createProvider({ acl: false })

      const { writeStream } = await provider.getUploadStream({
        filename: 'streamed.txt',
        mimeType: 'text/plain',
        access: 'public',
      })
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
        writeStream.end('hi')
      })

      expect(lastCommand('PutObjectCommand').input.ACL).toBeUndefined()
    })

    test('uses an explicit canned ACL over the one derived from access', async ({ expect }) => {
      const provider = createProvider({ acl: 'bucket-owner-full-control' })

      await provider.upload({
        filename: 'logo.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      expect(lastCommand('PutObjectCommand').input.ACL).toBe('bucket-owner-full-control')
    })
  })

  // ---------------------------------------------------------------------------
  // filename sanitization
  // ---------------------------------------------------------------------------

  test.describe('filename sanitization', () => {
    test('strips traversal segments so the key cannot escape the prefix', async ({ expect }) => {
      const provider = createProvider({ prefix: 'media' })

      const result = await provider.upload({
        filename: '../../secrets/key.png',
        mimeType: 'image/png',
        content: helloBase64,
        access: 'public',
      })

      expect(result.key).toMatch(/^media\/secrets\/\d+-key\.png$/)
      expect(result.key).not.toContain('..')
      expect(result.url).not.toContain('..')
    })

    test('strips traversal segments from presigned upload keys', async ({ expect }) => {
      const provider = createProvider({ prefix: 'media' })

      const result = await provider.getPresignedUploadUrl({ filename: '../../secrets/key.png', access: 'public' })

      expect(result.fields.key).toBe('media/secrets/key.png')
    })

    test('drops leading slashes and single-dot segments', async ({ expect }) => {
      const provider = createProvider({ prefix: 'media' })

      const result = await provider.getPresignedUploadUrl({ filename: '/a/./b/c.png', access: 'public' })

      expect(result.fields.key).toBe('media/a/b/c.png')
    })

    test('normalizes backslashes to posix separators', async ({ expect }) => {
      const provider = createProvider()

      const result = await provider.getPresignedUploadUrl({ filename: 'a\\b\\c.png', access: 'public' })

      expect(result.fields.key).toBe('a/b/c.png')
    })

    test('rejects a filename that sanitizes to nothing', async ({ expect }) => {
      const provider = createProvider()

      const error = await provider
        .upload({ filename: '../..', mimeType: 'image/png', content: helloBase64, access: 'public' })
        .catch((e) => e)

      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(error.message).toContain('Invalid filename')
      expect(s3.sent).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // getUploadStream
  // ---------------------------------------------------------------------------

  test.describe('getUploadStream', () => {
    test('uploads what is written to the stream once it ends', async ({ expect }) => {
      const provider = createProvider()

      const { writeStream, url } = await provider.getUploadStream({
        filename: 'streamed.txt',
        mimeType: 'text/plain',
        access: 'public',
      })

      expect(s3.sent.filter((command) => command.name === 'PutObjectCommand')).toHaveLength(0)

      writeStream.write('hello ')
      writeStream.write('world')
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
        writeStream.end()
      })

      const put = lastCommand('PutObjectCommand')
      expect(put.input.ContentType).toBe('text/plain')
      expect(put.input.ACL).toBe('public-read')
      expect(url).toBe(`https://cdn.example.com/${put.input.Key}`)
      expect(s3.storage.get(String(put.input.Key))?.toString('utf-8')).toBe('hello world')
    })
  })
})
