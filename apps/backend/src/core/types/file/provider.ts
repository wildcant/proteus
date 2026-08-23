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
} from './mutations.js'

export type IFileProvider = {
  /** The provider's `identifier`, e.g. `localfs` or `s3`. */
  getIdentifier(): string
  upload(file: ProviderUploadFileDTO): Promise<ProviderFileResultDTO>
  delete(file: ProviderDeleteFileDTO): Promise<void>
  getPresignedDownloadUrl(fileData: ProviderGetFileDTO): Promise<string>
  getDownloadStream(fileData: ProviderGetFileDTO): Promise<ProviderDownloadStream>
  getAsBuffer(fileData: ProviderGetFileDTO): Promise<Buffer>
  getUploadStream(data: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult>
  getPresignedUploadUrl?(data: ProviderGetPresignedUploadUrlDTO): Promise<ProviderPresignedUploadUrlResult>
}
