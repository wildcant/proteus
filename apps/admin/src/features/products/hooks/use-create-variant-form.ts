import { AdminCreateProductVariant } from '@proteus/http-schemas/admin'
import { z } from 'zod'
import type { AdminCreateProductVariantResponse } from '#/api/generated/model'
import { useCreateProductVariant } from '#/features/products/api/product-variants'
import type { CombinationOption } from '#/features/products/hooks/use-option-combination-search'
import { useAppForm } from '#/lib/form-hook.ts'
import type { SubmitFormParams } from '#/types/form.ts'

/**
 * The form holds the chosen combination itself, not its key — the payload needs its `optionValues`,
 * so a key would only have to be resolved back again at submit time. Picking a combination is one
 * choice, so it is one field.
 *
 * The combination is required — a variant *is* one combination of the product's option values, and
 * the server rejects a create that names none. There is no title field: a Variant Title is derived
 * from its combination, so there is nothing here for the shopkeeper to disagree with.
 */
const createVariantSchema = z.object({
  combination: z
    .custom<CombinationOption>()
    .nullable()
    .refine((combination) => combination !== null, { message: 'Pick a combination.' }),
  sku: z.string(),
})

type UseCreateVariantFormArgs = {
  productId: string
  params?: SubmitFormParams<AdminCreateProductVariantResponse>
}

export function useCreateVariantForm({ productId, params }: UseCreateVariantFormArgs) {
  const createMutation = useCreateProductVariant(productId)

  // `z.input`, not `z.infer`: the schema's output has the combination narrowed to non-null, which
  // is the point of it — the field still has to start empty and hold one.
  const defaultValues: z.input<typeof createVariantSchema> = { combination: null, sku: '' }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: createVariantSchema },
    onSubmit: ({ value }) => {
      createMutation.mutate(
        // Parsing rather than casting drops any key the endpoint rejects, and takes `unknown`, so
        // the combination needs no narrowing here — the validator has already refused a null one.
        // `prices` is omitted because the schema's pipeline outputs a BigNumber, which is not the
        // wire type, and this form does not set them.
        AdminCreateProductVariant.omit({ prices: true }).parse({
          sku: value.sku || null,
          optionValues: value.combination?.optionValues,
        }),
        {
          onSuccess: (created) => {
            form.reset()
            params?.onSuccess?.(created)
          },
          onError: (error) => params?.onError?.(error.message),
          onSettled: () => params?.onSettled?.(),
        },
      )
    },
  })

  return { form, isLoading: createMutation.isPending }
}
