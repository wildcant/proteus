import { test } from '@tests/setup/test-extend.js'
import { ErrorTypes } from '../../../core/errors/app-error.js'
import { FileModuleService } from '../services/file-module-service.js'
import { FileProviderService } from '../services/file-provider-service.js'
import { FILE_PROVIDER_REGISTRATION_PREFIX } from '../utils/constants.js'
import { InMemoryFileProvider } from './fixtures/in-memory-file-provider.js'

function createFileService(options?: { maxFileSize?: number }) {
  const provider = new InMemoryFileProvider()
  const fileProviderService = new FileProviderService(
    { [`${FILE_PROVIDER_REGISTRATION_PREFIX}in-memory_default`]: provider },
    options?.maxFileSize,
  )

  return new FileModuleService({ fileProviderService })
}

const base64Content = Buffer.from('hello world').toString('base64')

test.describe('FileModuleService', () => {
  // ---------------------------------------------------------------------------
  // createFiles / retrieveFile
  // ---------------------------------------------------------------------------

  test.describe('createFiles + retrieveFile', () => {
    test('creates a file and retrieves its URL', async ({ expect }) => {
      const service = createFileService()

      const files = await service.createFiles([
        { filename: 'test.txt', mimeType: 'text/plain', content: base64Content },
      ])

      expect(files).toHaveLength(1)
      const created = files[0]
      expect(created).toBeDefined()
      expect(created?.id).toBe('uploads/test.txt')
      expect(created?.url).toContain('test.txt')

      const retrieved = await service.retrieveFile(files[0]?.id ?? '')
      expect(retrieved.url).toBe(created?.url)
    })

    test('creates multiple files', async ({ expect }) => {
      const service = createFileService()

      const files = await service.createFiles([
        { filename: 'a.txt', mimeType: 'text/plain', content: base64Content },
        { filename: 'b.png', mimeType: 'image/png', content: base64Content },
        { filename: 'c.pdf', mimeType: 'application/pdf', content: base64Content },
      ])

      expect(files).toHaveLength(3)
      expect(files[0]?.id).toBe('uploads/a.txt')
      expect(files[1]?.id).toBe('uploads/b.png')
      expect(files[2]?.id).toBe('uploads/c.pdf')
    })

    test('rejects files exceeding maxFileSize', async ({ expect }) => {
      const service = createFileService({ maxFileSize: 5 })

      const error = await service
        .createFiles([{ filename: 'big.txt', mimeType: 'text/plain', content: base64Content }])
        .catch((e) => e)

      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(error.message).toContain('exceeds maximum size')
    })
  })

  // ---------------------------------------------------------------------------
  // deleteFiles
  // ---------------------------------------------------------------------------

  test.describe('deleteFiles', () => {
    test('deletes files by key', async ({ expect }) => {
      const service = createFileService()

      const files = await service.createFiles([
        { filename: 'to-delete.txt', mimeType: 'text/plain', content: base64Content },
      ])
      const fileId = files[0]?.id ?? ''

      await service.deleteFiles([fileId])

      const error = await service.retrieveFile(fileId).catch((e) => e)
      expect(error.type).toBe(ErrorTypes.NOT_FOUND)
    })
  })

  // ---------------------------------------------------------------------------
  // getUploadFileUrls
  // ---------------------------------------------------------------------------

  test.describe('getUploadFileUrls', () => {
    test('generates presigned upload URLs', async ({ expect }) => {
      const service = createFileService()

      const urls = await service.getUploadFileUrls([
        { filename: 'upload.txt' },
        { filename: 'upload2.png', access: 'public' },
      ])

      expect(urls).toHaveLength(2)
      expect(urls[0]?.url).toContain('upload.txt')
      expect(urls[0]?.fileKey).toBe('upload.txt')
      expect(urls[0]?.fields).toBeDefined()
      expect(urls[1]?.url).toContain('upload2.png')
    })

    test('rejects empty filename', async ({ expect }) => {
      const service = createFileService()

      const error = await service.getUploadFileUrls([{ filename: '' }]).catch((e) => e)

      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(error.message).toContain('Filename is required')
    })
  })

  // ---------------------------------------------------------------------------
  // listFiles
  // ---------------------------------------------------------------------------

  test.describe('listFiles', () => {
    test('throws without id filter', async ({ expect }) => {
      const service = createFileService()

      const error = await service.listFiles().catch((e) => e)

      expect(error.type).toBe(ErrorTypes.INVALID_DATA)
      expect(error.message).toContain('requires an "id" filter')
    })

    test('lists files by id', async ({ expect }) => {
      const service = createFileService()

      await service.createFiles([
        { filename: 'list-a.txt', mimeType: 'text/plain', content: base64Content },
        { filename: 'list-b.txt', mimeType: 'text/plain', content: base64Content },
      ])

      const files = await service.listFiles({ id: ['uploads/list-a.txt', 'uploads/list-b.txt'] })

      expect(files).toHaveLength(2)
      expect(files[0]?.url).toContain('list-a.txt')
      expect(files[1]?.url).toContain('list-b.txt')
    })
  })

  // ---------------------------------------------------------------------------
  // listAndCountFiles
  // ---------------------------------------------------------------------------

  test.describe('listAndCountFiles', () => {
    test('returns correct count', async ({ expect }) => {
      const service = createFileService()

      await service.createFiles([
        { filename: 'count-a.txt', mimeType: 'text/plain', content: base64Content },
        { filename: 'count-b.txt', mimeType: 'text/plain', content: base64Content },
        { filename: 'count-c.txt', mimeType: 'text/plain', content: base64Content },
      ])

      const [files, count] = await service.listAndCountFiles({
        id: ['uploads/count-a.txt', 'uploads/count-b.txt', 'uploads/count-c.txt'],
      })

      expect(files).toHaveLength(3)
      expect(count).toBe(3)
    })
  })

  // ---------------------------------------------------------------------------
  // getProvider
  // ---------------------------------------------------------------------------

  test.describe('getProvider', () => {
    test('returns provider instance', ({ expect }) => {
      const service = createFileService()

      const provider = service.getProvider()

      expect(provider).toBeInstanceOf(InMemoryFileProvider)
    })
  })

  // ---------------------------------------------------------------------------
  // Single provider constraint
  // ---------------------------------------------------------------------------

  test.describe('single provider constraint', () => {
    test('throws when no provider is registered', ({ expect }) => {
      expect(() => new FileProviderService({})).toThrow('exactly one provider')
    })

    test('throws when multiple providers are registered', ({ expect }) => {
      expect(
        () =>
          new FileProviderService({
            [`${FILE_PROVIDER_REGISTRATION_PREFIX}provider-a_default`]: new InMemoryFileProvider(),
            [`${FILE_PROVIDER_REGISTRATION_PREFIX}provider-b_default`]: new InMemoryFileProvider(),
          }),
      ).toThrow('exactly one provider')
    })
  })
})
