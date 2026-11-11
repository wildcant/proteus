import { useLingui } from '@lingui/react/macro'
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import type { AdminUploadFiles, AdminUploadResponse } from '#/api/generated/model'
import { createPresignedUploadUrl, uploadFiles } from '#/api/generated/uploads/uploads'

// Uploads have no list endpoint, so there is no cached collection to invalidate on success.
// Callers own whatever resource the returned file ids get attached to.
export const useUploadFiles = (options?: UseMutationOptions<AdminUploadResponse, Error, AdminUploadFiles>) => {
  const { t } = useLingui()
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUploadFiles) => uploadFiles(data),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to upload files`, description: error.message })
      onError?.(...args)
    },
  })
}

/** What a private upload answers: the id a resource reading the file is created with. */
type PrivateUpload = { fileId: string }

/**
 * Stores one file privately and answers its id. The file goes straight to storage through a
 * presigned URL. A provider with no direct upload (local disk) answers the relative multipart
 * endpoint instead, and the file is posted there.
 */
export const useUploadPrivateFile = (options?: UseMutationOptions<PrivateUpload, Error, File>) => {
  const { t } = useLingui()
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: async (file: File): Promise<PrivateUpload> => {
      const mimeType = file.type || 'application/octet-stream'
      const presigned = await createPresignedUploadUrl({
        originalName: file.name,
        mimeType,
        size: file.size,
        access: 'private',
      })

      if (!URL.canParse(presigned.url)) {
        const { files } = await uploadFiles({ files: [file], access: 'private' })
        const [uploaded] = files
        if (!uploaded) throw new Error('The upload returned no file')
        return { fileId: uploaded.id }
      }

      const response = await fetch(presigned.url, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } })
      if (!response.ok) throw new Error(`The upload failed with status ${response.status}`)
      return { fileId: presigned.fileKey }
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: t`Failed to upload file`, description: error.message })
      onError?.(...args)
    },
  })
}
