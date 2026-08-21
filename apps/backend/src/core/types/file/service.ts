import type { FindConfig } from '../common.js'
import type { FileDTO, FilterableFileProps, UploadFileUrlDTO } from './common.js'
import type {
  CreateFileDTO,
  GetUploadFileUrlDTO,
  ProviderDownloadStream,
  ProviderUploadStreamDTO,
  ProviderUploadStreamResult,
} from './mutations.js'
import type { IFileProvider } from './provider.js'

export type IFileModuleService = {
  createFiles(data: CreateFileDTO[]): Promise<FileDTO[]>
  deleteFiles(ids: string[]): Promise<void>
  retrieveFile(id: string): Promise<FileDTO>
  listFiles(filters?: FilterableFileProps, config?: FindConfig<FileDTO>): Promise<FileDTO[]>
  listAndCountFiles(filters?: FilterableFileProps, config?: FindConfig<FileDTO>): Promise<[FileDTO[], number]>
  getUploadFileUrls(data: GetUploadFileUrlDTO[]): Promise<UploadFileUrlDTO[]>
  getProvider(): IFileProvider
  getDownloadStream(id: string): Promise<ProviderDownloadStream>
  getAsBuffer(id: string): Promise<Buffer>
  getUploadStream(data: ProviderUploadStreamDTO): Promise<ProviderUploadStreamResult>
}
