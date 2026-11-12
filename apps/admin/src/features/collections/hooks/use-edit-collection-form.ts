import { AdminUpdateProductCollection } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminProductCollection, AdminProductCollectionResponse } from '#/api/generated/model'
import { useUpdateCollection } from '#/features/collections/api/collections'
import {
  type CollectionThumbnail,
  useUploadCollectionThumbnail,
} from '#/features/collections/hooks/use-upload-collection-thumbnail'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

const editCollectionSchema = AdminUpdateProductCollection.pick({ title: true, handle: true }).extend({
  thumbnail: z.custom<CollectionThumbnail>().nullable(),
})

/** A new thumbnail is uploaded on save; removing it sends `null`. */
export function useEditCollectionForm(
  collection: AdminProductCollection,
  params?: SubmitFormParams<AdminProductCollectionResponse>,
) {
  const updateMutation = useUpdateCollection(collection.id)
  const { uploadThumbnail } = useUploadCollectionThumbnail()

  const defaultValues: z.input<typeof editCollectionSchema> = {
    title: collection.title,
    handle: collection.handle,
    thumbnail: collection.thumbnail ? { url: collection.thumbnail } : null,
  }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: editCollectionSchema },
    onSubmit: async ({ value }) => {
      try {
        const thumbnail = await uploadThumbnail(value.thumbnail)
        const data = await updateMutation.mutateAsync(
          AdminUpdateProductCollection.parse({ title: value.title, handle: value.handle, thumbnail }),
        )
        form.reset()
        params?.onSuccess?.(data)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
