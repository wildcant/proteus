import { msg } from '@lingui/core/macro'
import { AdminCreateProductImport } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminProductImport } from '#/api/generated/model'
import { useCreateProductImport } from '#/features/products/api/product-imports'
import { useUploadPrivateFile } from '#/features/uploads/api/uploads'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** The file is held until submit, so a merchant who cancels leaves nothing behind in storage. */
const uploadProductImportSchema = AdminCreateProductImport.pick({ overwrite: true, publish: true }).extend({
  file: z
    .custom<File>()
    .nullable()
    .refine((file) => file !== null, { message: msg`Choose a CSV file to import.`.id }),
})

/**
 * Upload file: stores the CSV privately — a catalogue is not for the public — then asks the server
 * to read it. The job comes back whether or not the file is valid; the caller decides from its
 * errors whether there is anything to preview.
 */
export function useUploadProductImportForm(params?: SubmitFormParams<AdminProductImport>) {
  const uploadMutation = useUploadPrivateFile()
  const createMutation = useCreateProductImport()

  const defaultValues: z.input<typeof uploadProductImportSchema> = { file: null, overwrite: false, publish: true }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: uploadProductImportSchema },
    onSubmit: async ({ value }) => {
      try {
        if (!value.file) return
        const { fileId } = await uploadMutation.mutateAsync(value.file)
        const { productImport } = await createMutation.mutateAsync(
          AdminCreateProductImport.parse({ fileId, overwrite: value.overwrite, publish: value.publish }),
        )
        params?.onSuccess?.(productImport)
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
