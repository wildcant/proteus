import * as fs from 'node:fs'
import * as path from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { ErrorTypes } from '../../../core/errors/app-error.js'
import { LocalFileProvider } from '../local-file-provider.js'

const testUploadDir = path.join(process.cwd(), 'test-static-uploads')
const backendUrl = 'http://localhost:3010/static'

function createProvider(options?: { uploadDir?: string; privateUploadDir?: string; backendUrl?: string }) {
  return new LocalFileProvider(
    {},
    {
      uploadDir: options?.uploadDir ?? testUploadDir,
      privateUploadDir: options?.privateUploadDir,
      backendUrl: options?.backendUrl ?? backendUrl,
    },
  )
}

beforeEach(() => {
  fs.mkdirSync(testUploadDir, { recursive: true })
})

afterEach(() => {
  fs.rmSync(testUploadDir, { recursive: true, force: true })
})

const base64Content = Buffer.from('hello world').toString('base64')

describe('LocalFileProvider', () => {
  test('identifier is "localfs"', () => {
    expect(LocalFileProvider.identifier).toBe('localfs')
  })

  // ---------------------------------------------------------------------------
  // upload + read back
  // ---------------------------------------------------------------------------

  describe('upload', () => {
    test('writes file to disk and returns url + key', async () => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'test.txt',
        mimeType: 'text/plain',
        content: base64Content,
        access: 'public',
      })

      expect(result.key).toMatch(/^\d+-test\.txt$/)
      expect(result.url).toBe(`${backendUrl}/${result.key}`)

      const filePath = path.join(testUploadDir, result.key)
      expect(fs.existsSync(filePath)).toBe(true)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello world')
    })

    test('private files get "private-" prefix in key', async () => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'secret.txt',
        mimeType: 'text/plain',
        content: base64Content,
        access: 'private',
      })

      expect(result.key).toMatch(/^private-\d+-secret\.txt$/)
    })

    test('rejects path traversal in filename', async () => {
      const provider = createProvider()

      const error = await provider
        .upload({
          filename: '../../etc/passwd',
          mimeType: 'text/plain',
          content: base64Content,
          access: 'public',
        })
        .catch((e) => e)

      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(error.message).toContain('path traversal')
    })
  })

  // ---------------------------------------------------------------------------
  // content decoding
  // ---------------------------------------------------------------------------

  describe('decodeFileContent', () => {
    test('decodes base64 content', async () => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'b64.txt',
        mimeType: 'text/plain',
        content: base64Content,
        access: 'public',
      })

      const filePath = path.join(testUploadDir, result.key)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('hello world')
    })

    test('decodes UTF-8 text for text MIME types', async () => {
      const provider = createProvider()
      const textContent = 'plain text content, not base64'

      const result = await provider.upload({
        filename: 'plain.txt',
        mimeType: 'text/plain',
        content: textContent,
        access: 'public',
      })

      const filePath = path.join(testUploadDir, result.key)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('plain text content, not base64')
    })

    test('decodes UTF-8 for json MIME type', async () => {
      const provider = createProvider()
      const jsonContent = '{"key": "value"}'

      const result = await provider.upload({
        filename: 'data.json',
        mimeType: 'application/json',
        content: jsonContent,
        access: 'public',
      })

      const filePath = path.join(testUploadDir, result.key)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('{"key": "value"}')
    })

    test('decodes UTF-8 for csv MIME type', async () => {
      const provider = createProvider()
      const csvContent = 'a,b,c\n1,2,3'

      const result = await provider.upload({
        filename: 'data.csv',
        mimeType: 'text/csv',
        content: csvContent,
        access: 'public',
      })

      const filePath = path.join(testUploadDir, result.key)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('a,b,c\n1,2,3')
    })

    test('decodes UTF-8 for xml MIME type', async () => {
      const provider = createProvider()
      const xmlContent = '<root><item>1</item></root>'

      const result = await provider.upload({
        filename: 'data.xml',
        mimeType: 'application/xml',
        content: xmlContent,
        access: 'public',
      })

      const filePath = path.join(testUploadDir, result.key)
      expect(fs.readFileSync(filePath, 'utf-8')).toBe('<root><item>1</item></root>')
    })

    test('falls back to binary for non-text MIME types', async () => {
      const provider = createProvider()
      const binaryData = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
      const binaryBase64 = binaryData.toString('base64')

      const result = await provider.upload({
        filename: 'image.jpg',
        mimeType: 'image/jpeg',
        content: binaryBase64,
        access: 'public',
      })

      const filePath = path.join(testUploadDir, result.key)
      const written = fs.readFileSync(filePath)
      expect(Buffer.compare(written, binaryData)).toBe(0)
    })
  })

  // ---------------------------------------------------------------------------
  // delete
  // ---------------------------------------------------------------------------

  describe('delete', () => {
    test('removes file from disk', async () => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'to-delete.txt',
        mimeType: 'text/plain',
        content: base64Content,
        access: 'public',
      })

      const filePath = path.join(testUploadDir, result.key)
      expect(fs.existsSync(filePath)).toBe(true)

      await provider.delete({ fileKey: result.key })
      expect(fs.existsSync(filePath)).toBe(false)
    })

    test('silently succeeds for non-existent files', async () => {
      const provider = createProvider()

      await expect(provider.delete({ fileKey: 'does-not-exist.txt' })).resolves.toBeUndefined()
    })

    test('rejects path traversal in fileKey', async () => {
      const provider = createProvider()

      const error = await provider.delete({ fileKey: '../../etc/passwd' }).catch((e) => e)

      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(error.message).toContain('path traversal')
    })
  })

  // ---------------------------------------------------------------------------
  // getPresignedDownloadUrl
  // ---------------------------------------------------------------------------

  describe('getPresignedDownloadUrl', () => {
    test('returns URL for existing file', async () => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'download.txt',
        mimeType: 'text/plain',
        content: base64Content,
        access: 'public',
      })

      const url = await provider.getPresignedDownloadUrl({ fileKey: result.key })
      expect(url).toBe(`${backendUrl}/${result.key}`)
    })

    test('throws for non-existent files', async () => {
      const provider = createProvider()

      const error = await provider.getPresignedDownloadUrl({ fileKey: 'missing.txt' }).catch((e) => e)

      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    })
  })

  // ---------------------------------------------------------------------------
  // getPresignedUploadUrl
  // ---------------------------------------------------------------------------

  describe('getPresignedUploadUrl', () => {
    test('returns url and key', async () => {
      const provider = createProvider()

      const result = await provider.getPresignedUploadUrl({
        filename: 'upload.txt',
        access: 'public',
      })

      expect(result.url).toBe('/admin/uploads')
      expect(result.fields).toEqual({ key: 'upload.txt' })
    })
  })

  // ---------------------------------------------------------------------------
  // getDownloadStream
  // ---------------------------------------------------------------------------

  describe('getDownloadStream', () => {
    test('returns readable stream of file content', async () => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'stream.txt',
        mimeType: 'text/plain',
        content: base64Content,
        access: 'public',
      })

      const stream = await provider.getDownloadStream({ fileKey: result.key })
      const chunks: Buffer[] = []
      for await (const chunk of stream) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      }
      expect(Buffer.concat(chunks).toString('utf-8')).toBe('hello world')
    })
  })

  // ---------------------------------------------------------------------------
  // getAsBuffer
  // ---------------------------------------------------------------------------

  describe('getAsBuffer', () => {
    test('returns file content as buffer', async () => {
      const provider = createProvider()

      const result = await provider.upload({
        filename: 'buffer.txt',
        mimeType: 'text/plain',
        content: base64Content,
        access: 'public',
      })

      const buffer = await provider.getAsBuffer({ fileKey: result.key })
      expect(buffer.toString('utf-8')).toBe('hello world')
    })
  })
})
