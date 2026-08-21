import { AppError, ErrorTypes } from '../../../core/errors/app-error.js'
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
} from '../../../core/types/file/mutations.js'
import type { IFileProvider } from '../../../core/types/file/provider.js'
import { FILE_PROVIDER_REGISTRATION_PREFIX } from '../constants.js'

type InjectedDependencies = {
  [key: `${typeof FILE_PROVIDER_REGISTRATION_PREFIX}${string}`]: IFileProvider
}

const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export class FileProviderService {
  protected readonly provider: IFileProvider
  readonly maxFileSize: number

  constructor(container: InjectedDependencies, maxFileSize?: number) {
    this.maxFileSize = maxFileSize ?? DEFAULT_MAX_FILE_SIZE
    const providerKeys = Object.keys(container).filter((key) => key.startsWith(FILE_PROVIDER_REGISTRATION_PREFIX))

    if (providerKeys.length !== 1) {
      throw new AppError({
        type: ErrorTypes.INVALID_DATA,
        message: 'File module must be initialized with exactly one provider.',
      })
    }

    const key = providerKeys[0] as `${typeof FILE_PROVIDER_REGISTRATION_PREFIX}${string}`
    const provider = container[key]
    if (!provider) {
      throw new AppError({
        type: ErrorTypes.NOT_FOUND,
        message: 'File provider could not be resolved.',
      })
    }
    this.provider = provider
  }

  getProvider(): IFileProvider {
    return this.provider
  }

  upload(file: ProviderUploadFileDTO): Promise<ProviderFileResultDTO> {
    return this.provider.upload(file)
  }

  delete(file: ProviderDeleteFileDTO): Promise<void> {
    return this.provider.delete(file)
  }

  getPresignedDownloadUrl(fileData: ProviderGetFileDTO): Promise<string> {
    return this.provider.getPresignedDownloadUrl(fileData)
  }

  getPresignedUploadUrl(fileData: ProviderGetPresignedUploadUrlDTO): Promise<ProviderPresignedUploadUrlResult> {
    if (!this.provider.getPresignedUploadUrl) {
      throw new AppError({
        type: ErrorTypes.NOT_ALLOWED,
        message: 'The configured file provider does not support presigned upload URLs.',
      })
    }

    return this.provider.getPresignedUploadUrl(fileData)
  }

  getDownloadStream(fileData: ProviderGetFileDTO): Promise<ProviderDownloadStream> {
    return this.provider.getDownloadStream(fileData)
  }

  getAsBuffer(fileData: ProviderGetFileDTO): Promise<Buffer> {
    return this.provider.getAsBuffer(fileData)
  }

  getUploadStream(fileData: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult> {
    return this.provider.getUploadStream(fileData)
  }
}
