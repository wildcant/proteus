import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import type { AdminUploadFiles, AdminUploadResponse } from '#/api/generated/model'
import { uploadFiles } from '#/api/generated/uploads/uploads'

// Uploads have no list endpoint, so there is no cached collection to invalidate on success.
// Callers own whatever resource the returned file ids get attached to.
export const useUploadFiles = (options?: UseMutationOptions<AdminUploadResponse, Error, AdminUploadFiles>) => {
  const { onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: AdminUploadFiles) => uploadFiles(data),
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to upload files', description: error.message })
      onError?.(...args)
    },
  })
}
