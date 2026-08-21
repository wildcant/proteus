export type FileDTO = {
  id: string
  url: string
}

export type FilterableFileProps = {
  id?: string | string[]
}

export type UploadFileUrlDTO = {
  url: string
  fields: Record<string, string>
  fileKey: string
}
