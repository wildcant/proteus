import { createReadStream } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
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

type LocalFileProviderConfig = {
  uploadDir?: string
  privateUploadDir?: string
  backendUrl?: string
}

export class LocalFileProvider extends AbstractFileProviderService<LocalFileProviderConfig> {
  static identifier = 'localfs'

  private uploadDir: string
  private privateUploadDir: string
  private backendUrl: string

  constructor(container: Record<string, unknown>, config: LocalFileProviderConfig) {
    super(container, config)

    this.uploadDir = config.uploadDir ?? path.join(process.cwd(), 'static')
    this.privateUploadDir = config.privateUploadDir ?? this.uploadDir
    this.backendUrl = config.backendUrl ?? 'http://localhost:3000/static'
  }

  private getBaseDir(fileKey: string): string {
    return fileKey.startsWith('private-') ? this.privateUploadDir : this.uploadDir
  }

  private getUploadFilePath(baseDir: string, fileKey: string): string {
    const resolvedBase = path.resolve(baseDir)
    const resolved = path.resolve(resolvedBase, fileKey)
    const relative = path.relative(resolvedBase, resolved)

    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: `Rejected path traversal attempt: "${fileKey}"`,
      })
    }

    return resolved
  }

  private getUploadFileUrl(fileKey: string): string {
    const baseUrl = new URL(this.backendUrl)
    baseUrl.pathname = path.join(baseUrl.pathname, fileKey)
    return baseUrl.href
  }

  private async ensureDirExists(baseDir: string, dirPath: string): Promise<void> {
    const fullPath = path.join(baseDir, dirPath)
    try {
      await fs.access(fullPath)
    } catch {
      await fs.mkdir(fullPath, { recursive: true })
    }
  }

  async upload(file: ProviderUploadFileDTO): Promise<ProviderFileResultDTO> {
    const parsedFilename = path.parse(file.filename)
    const baseDir = file.access === 'public' ? this.uploadDir : this.privateUploadDir

    // Validate the raw filename before building the key
    this.getUploadFilePath(baseDir, file.filename)

    await this.ensureDirExists(baseDir, parsedFilename.dir)

    const fileKey = path.join(
      parsedFilename.dir,
      `${file.access === 'public' ? '' : 'private-'}${Date.now()}-${parsedFilename.base}`,
    )

    const filePath = this.getUploadFilePath(baseDir, fileKey)
    const fileUrl = this.getUploadFileUrl(fileKey)

    const content = decodeFileContent(file.content, file.mimeType)
    await fs.writeFile(filePath, content)

    return { url: fileUrl, key: fileKey }
  }

  async delete(file: ProviderDeleteFileDTO): Promise<void> {
    const baseDir = this.getBaseDir(file.fileKey)
    const filePath = this.getUploadFilePath(baseDir, file.fileKey)

    try {
      await fs.access(filePath)
      await fs.unlink(filePath)
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return
      }
      throw error
    }
  }

  async getPresignedDownloadUrl(fileData: ProviderGetFileDTO): Promise<string> {
    const baseDir = this.getBaseDir(fileData.fileKey)
    const filePath = this.getUploadFilePath(baseDir, fileData.fileKey)

    try {
      await fs.access(filePath)
    } catch {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `File with key ${fileData.fileKey} not found`,
      })
    }

    return this.getUploadFileUrl(fileData.fileKey)
  }

  async getDownloadStream(fileData: ProviderGetFileDTO): Promise<ProviderDownloadStream> {
    const baseDir = this.getBaseDir(fileData.fileKey)
    const filePath = this.getUploadFilePath(baseDir, fileData.fileKey)

    try {
      await fs.access(filePath)
    } catch {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: `File with key ${fileData.fileKey} not found`,
      })
    }

    return createReadStream(filePath)
  }

  async getAsBuffer(fileData: ProviderGetFileDTO): Promise<Buffer> {
    const baseDir = this.getBaseDir(fileData.fileKey)
    const filePath = this.getUploadFilePath(baseDir, fileData.fileKey)
    return fs.readFile(filePath)
  }

  async getUploadStream(_data: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult> {
    throw new AppError({
      type: ErrorTypes.NOT_ALLOWED,
      message: 'getUploadStream not supported by local filesystem provider.',
    })
  }

  async getPresignedUploadUrl(data: ProviderGetPresignedUploadUrlDTO): Promise<ProviderPresignedUploadUrlResult> {
    return {
      url: '/admin/uploads',
      fields: { key: data.filename },
    }
  }
}
