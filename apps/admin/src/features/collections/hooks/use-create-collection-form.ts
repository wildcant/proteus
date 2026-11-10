import { AdminCreateProductCollection } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminProductCollectionResponse } from '#/api/generated/model'
import { useCreateCollection } from '#/features/collections/api/collections'
import {
  type CollectionThumbnail,
  useUploadCollectionThumbnail,
} from '#/features/collections/hooks/use-upload-collection-thumbnail'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/**
 * The form holds the thumbnail as a staged file until save, when it is uploaded and only its URL
 * is sent. A blank handle is left out so the server generates one from the title.
 */
const createCollectionSchema = AdminCreateProductCollection.pick({ title: true }).extend({
  handle: z.string(),
  thumbnail: z.custom<CollectionThumbnail>().nullable(),
})

export function useCreateCollectionForm(params?: SubmitFormParams<AdminProductCollectionResponse>) {
  const createMutation = useCreateCollection()
  const { uploadThumbnail } = useUploadCollectionThumbnail()

  const defaultValues: z.input<typeof createCollectionSchema> = { title: '', handle: '', thumbnail: null }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: createCollectionSchema },
    onSubmit: async ({ value }) => {
      try {
        const thumbnail = await uploadThumbnail(value.thumbnail)
        const data = await createMutation.mutateAsync(
          AdminCreateProductCollection.parse({
            title: value.title,
            handle: value.handle.trim() || undefined,
            thumbnail,
          }),
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
