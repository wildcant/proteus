import type { Readable, Writable } from 'node:stream'

export type CreateFileDTO = {
  filename: string
  mimeType: string
  content: string
  access?: 'public' | 'private'
}

export type GetUploadFileUrlDTO = {
  filename: string
  access?: 'public' | 'private'
}

// ---------------------------------------------------------------------------
// Provider types
// ---------------------------------------------------------------------------

export type ProviderUploadFileDTO = {
  filename: string
  mimeType: string
  content: string
  access: 'public' | 'private'
}

export type ProviderFileResultDTO = {
  url: string
  key: string
}

export type ProviderDeleteFileDTO = {
  fileKey: string
}

export type ProviderGetFileDTO = {
  fileKey: string
}

export type ProviderGetPresignedUploadUrlDTO = {
  filename: string
  access: 'public' | 'private'
}

export type ProviderUploadStreamDTO = {
  filename: string
  mimeType: string
  access: 'public' | 'private'
}

export type ProviderUploadStreamResult = {
  writeStream: Writable
  url: string
}

export type ProviderPresignedUploadUrlResult = {
  url: string
  fields: Record<string, string>
}

export type ProviderDownloadStream = Readable
