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
} from '../types/file/mutations.js'
import type { IFileProvider } from '../types/file/provider.js'

export abstract class AbstractFileProviderService<TConfig = Record<string, unknown>> implements IFileProvider {
  static identifier: string

  protected config: TConfig
  protected container: Record<string, unknown>

  constructor(container: Record<string, unknown>, config: TConfig) {
    this.container = container
    this.config = config
  }

  getIdentifier(): string {
    const ctr = this.constructor as typeof AbstractFileProviderService

    if (!ctr.identifier) {
      throw new Error('Missing static property "identifier".')
    }

    return ctr.identifier
  }

  async upload(_file: ProviderUploadFileDTO): Promise<ProviderFileResultDTO> {
    throw new Error('upload not implemented by this file provider.')
  }

  async delete(_file: ProviderDeleteFileDTO): Promise<void> {
    throw new Error('delete not implemented by this file provider.')
  }

  async getPresignedDownloadUrl(_fileData: ProviderGetFileDTO): Promise<string> {
    throw new Error('getPresignedDownloadUrl not implemented by this file provider.')
  }

  async getDownloadStream(_fileData: ProviderGetFileDTO): Promise<ProviderDownloadStream> {
    throw new Error('getDownloadStream not implemented by this file provider.')
  }

  async getAsBuffer(_fileData: ProviderGetFileDTO): Promise<Buffer> {
    throw new Error('getAsBuffer not implemented by this file provider.')
  }

  async getUploadStream(_data: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult> {
    throw new Error('getUploadStream not implemented by this file provider.')
  }

  // Optional — providers override if supported
  getPresignedUploadUrl?(_data: ProviderGetPresignedUploadUrlDTO): Promise<ProviderPresignedUploadUrlResult>
}
