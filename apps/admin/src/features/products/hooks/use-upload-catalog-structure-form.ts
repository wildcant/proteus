import { msg } from '@lingui/core/macro'
import { AdminApplyCatalogStructure } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminCatalogStructurePlan } from '#/api/generated/model'
import { usePreviewCatalogStructure } from '#/features/products/api/catalog-structure'
import { useUploadPrivateFile } from '#/features/uploads/api/uploads'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/** The file is held until submit, so a merchant who cancels leaves nothing behind in storage. */
const uploadCatalogStructureSchema = z.object({
  file: z
    .custom<File>()
    .nullable()
    .refine((file) => file !== null, { message: msg`Choose a structure file to import.`.id }),
})

/** What the server read the file as, and the upload it read, which applying names again. */
export type PreviewedCatalogStructure = { fileId: string; plan: AdminCatalogStructurePlan }

/**
 * Upload file: stores the YAML privately, then asks the server what applying it would do. The plan
 * comes back whether or not the file is valid; the caller decides from its errors what to show.
 */
export function useUploadCatalogStructureForm(params?: SubmitFormParams<PreviewedCatalogStructure>) {
  const uploadMutation = useUploadPrivateFile()
  const previewMutation = usePreviewCatalogStructure()

  const defaultValues: z.input<typeof uploadCatalogStructureSchema> = { file: null }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: uploadCatalogStructureSchema },
    onSubmit: async ({ value }) => {
      try {
        if (!value.file) return
        const { fileId } = await uploadMutation.mutateAsync(value.file)
        const { catalogStructure } = await previewMutation.mutateAsync(AdminApplyCatalogStructure.parse({ fileId }))
        params?.onSuccess?.({ fileId, plan: catalogStructure })
      } catch (error) {
        params?.onError?.(errorMessage(error))
      } finally {
        params?.onSettled?.()
      }
    },
  })

  return { form }
}
