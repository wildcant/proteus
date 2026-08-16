import { z } from 'zod'
import type { AdminProductOptionResponse } from '#/api/generated/model'
import { useCreateProductOption } from '#/features/product-options/api/product-options'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

const createOptionFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  values: z.array(z.string()),
})

type CreateOptionFormValues = z.infer<typeof createOptionFormSchema>

export type CreateProductOptionFormParams = SubmitFormParams<AdminProductOptionResponse>

export function useCreateProductOptionForm(params?: CreateProductOptionFormParams) {
  const createMutation = useCreateProductOption()

  const form = useAppForm({
    defaultValues: { title: '', values: [] } satisfies CreateOptionFormValues as CreateOptionFormValues,
    validators: { onSubmit: createOptionFormSchema },
    onSubmit: ({ value }) => {
      const values = value.values.map((v, rank) => ({ value: v, rank }))
      createMutation.mutate(
        { title: value.title, values: values.length > 0 ? values : undefined },
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

  return { form, isLoading: createMutation.isPending }
}
