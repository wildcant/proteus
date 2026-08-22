import { Buffer } from 'node:buffer'
import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
import type { FindConfig } from '../../../core/types/common.js'
import type { FileDTO, FilterableFileProps, UploadFileUrlDTO } from '../../../core/types/file/common.js'
import type {
  CreateFileDTO,
  GetUploadFileUrlDTO,
  ProviderDownloadStream,
  ProviderUploadStreamDTO,
  ProviderUploadStreamResult,
} from '../../../core/types/file/mutations.js'
import type { IFileProvider } from '../../../core/types/file/provider.js'
import type { IFileModuleService } from '../../../core/types/file/service.js'
import type { FileProviderService } from './file-provider-service.js'

type InjectedDependencies = {
  fileProviderService: FileProviderService
}

export class FileModuleService implements IFileModuleService {
  private fileProviderService: FileProviderService

  constructor({ fileProviderService }: InjectedDependencies) {
    this.fileProviderService = fileProviderService
  }

  async createFiles(data: CreateFileDTO[]): Promise<FileDTO[]> {
    return Promise.all(
      data.map(async (file) => {
        const size = Buffer.byteLength(file.content, 'base64')
        const { maxFileSize } = this.fileProviderService
        if (size > maxFileSize) {
          throw new AppError({
            type: ErrorTypes.INVALID_DATA,
            message: `File "${file.filename}" exceeds maximum size of ${maxFileSize} bytes (got ${size} bytes).`,
          })
        }

        const result = await this.fileProviderService.upload({
          filename: file.filename,
          mimeType: file.mimeType,
          content: file.content,
          access: file.access ?? 'private',
        })

        return { id: result.key, url: result.url }
      }),
    )
  }

  async deleteFiles(ids: string[]): Promise<void> {
    await Promise.all(ids.map((id) => this.fileProviderService.delete({ fileKey: id })))
  }

  async retrieveFile(id: string): Promise<FileDTO> {
    const url = await this.fileProviderService.getPresignedDownloadUrl({ fileKey: id })
    return { id, url }
  }

  async listFiles(filters?: FilterableFileProps, config?: FindConfig<FileDTO>): Promise<FileDTO[]> {
    if (!filters?.id) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: 'File listing requires an "id" filter.',
      })
    }

    const ids = Array.isArray(filters.id) ? filters.id : [filters.id]

    const files = await Promise.all(
      ids.map(async (id) => {
        const url = await this.fileProviderService.getPresignedDownloadUrl({ fileKey: id })
        return { id, url }
      }),
    )

    const offset = config?.offset ?? 0
    const limit = config?.limit ?? files.length
    return files.slice(offset, offset + limit)
  }

  async listAndCountFiles(filters?: FilterableFileProps, config?: FindConfig<FileDTO>): Promise<[FileDTO[], number]> {
    if (!filters?.id) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: 'File listing requires an "id" filter.',
      })
    }

    const ids = Array.isArray(filters.id) ? filters.id : [filters.id]
    const totalCount = ids.length

    const files = await Promise.all(
      ids.map(async (id) => {
        const url = await this.fileProviderService.getPresignedDownloadUrl({ fileKey: id })
        return { id, url }
      }),
    )

    const offset = config?.offset ?? 0
    const limit = config?.limit ?? files.length
    return [files.slice(offset, offset + limit), totalCount]
  }

  async getUploadFileUrls(data: GetUploadFileUrlDTO[]): Promise<UploadFileUrlDTO[]> {
    return Promise.all(
      data.map(async (input) => {
        if (!input.filename) {
          throw new AppError({
            type: ErrorTypes.INVALID_DATA,
            message: 'Filename is required for presigned upload URL generation.',
          })
        }

        const result = await this.fileProviderService.getPresignedUploadUrl({
          filename: input.filename,
          access: input.access ?? 'private',
        })

        return {
          url: result.url,
          fields: result.fields,
          fileKey: input.filename,
        }
      }),
    )
  }

  getProvider(): IFileProvider {
    return this.fileProviderService.getProvider()
  }

  async getDownloadStream(id: string): Promise<ProviderDownloadStream> {
    return this.fileProviderService.getDownloadStream({ fileKey: id })
  }

  async getAsBuffer(id: string): Promise<Buffer> {
    return this.fileProviderService.getAsBuffer({ fileKey: id })
  }

  async getUploadStream(data: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult> {
    return this.fileProviderService.getUploadStream(data)
  }
}
