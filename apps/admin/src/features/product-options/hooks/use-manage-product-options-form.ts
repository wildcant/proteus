import { z } from 'zod'
import type { AdminSetProductOptionsResponse } from '#/api/generated/model'
import { useSetProductOptions } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

const optionItemSchema = z.object({
  optionId: z.string().min(1),
  valueIds: z.array(z.string().min(1)),
})

const manageProductOptionsSchema = z.object({
  options: z.array(optionItemSchema),
})

type ManageProductOptionsFormValues = z.infer<typeof manageProductOptionsSchema>

export type ManageProductOptionsFormParams = SubmitFormParams<AdminSetProductOptionsResponse>

type UseManageProductOptionsFormArgs = {
  productId: string
  defaultValues: ManageProductOptionsFormValues
  params?: ManageProductOptionsFormParams
}

export function useManageProductOptionsForm({ productId, defaultValues, params }: UseManageProductOptionsFormArgs) {
  const mutation = useSetProductOptions(productId)

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: manageProductOptionsSchema },
    onSubmit: ({ value }) => {
      mutation.mutate(
        { options: value.options },
        {
          onSuccess: (data) => {
            form.reset()
            params?.onSuccess?.(data)
          },
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isLoading: mutation.isPending }
}
