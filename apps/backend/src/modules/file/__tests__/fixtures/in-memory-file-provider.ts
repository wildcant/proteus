import { Readable } from 'node:stream'
import { AppError, ErrorTypes } from '../../../../core/errors/app-error.js'
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
} from '../../../../core/types/file/mutations.js'
import { AbstractFileProviderService } from '../../../../core/utils/abstract-file-provider.js'

type StoredFile = {
  content: string
  mimeType: string
  url: string
}

export class InMemoryFileProvider extends AbstractFileProviderService {
  static identifier = 'in-memory'

  private files = new Map<string, StoredFile>()

  constructor() {
    super({}, {})
  }

  async upload(file: ProviderUploadFileDTO): Promise<ProviderFileResultDTO> {
    const key = `uploads/${file.filename}`
    const url = `https://storage.test/${key}`

    this.files.set(key, {
      content: file.content,
      mimeType: file.mimeType,
      url,
    })

    return { url, key }
  }

  async delete(file: ProviderDeleteFileDTO): Promise<void> {
    this.files.delete(file.fileKey)
  }

  async getPresignedDownloadUrl(fileData: ProviderGetFileDTO): Promise<string> {
    const stored = this.files.get(fileData.fileKey)
    if (!stored) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `File "${fileData.fileKey}" not found.`,
      })
    }
    return stored.url
  }

  async getDownloadStream(fileData: ProviderGetFileDTO): Promise<ProviderDownloadStream> {
    const stored = this.files.get(fileData.fileKey)
    if (!stored) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `File "${fileData.fileKey}" not found.`,
      })
    }
    return Readable.from(Buffer.from(stored.content, 'base64'))
  }

  async getAsBuffer(fileData: ProviderGetFileDTO): Promise<Buffer> {
    const stored = this.files.get(fileData.fileKey)
    if (!stored) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `File "${fileData.fileKey}" not found.`,
      })
    }
    return Buffer.from(stored.content, 'base64')
  }

  async getUploadStream(_data: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult> {
    throw new Error('getUploadStream not supported by in-memory provider.')
  }

  async getPresignedUploadUrl(data: ProviderGetPresignedUploadUrlDTO): Promise<ProviderPresignedUploadUrlResult> {
    const key = `uploads/${data.filename}`
    return {
      url: `https://storage.test/upload/${key}`,
      fields: { key },
    }
  }
}
