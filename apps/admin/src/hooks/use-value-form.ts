import type { z } from 'zod'
import { useAppForm } from '#/lib/form-hook.ts'
import { errorMessage, type SubmitFormParams } from '#/types/form.ts'

/**
 * What a value entity — a Product Type, a Product Tag — is created or renamed with. Optional as the
 * update body's input is; the form always starts it as a string.
 */
type ValueFormValues = { value?: string }

// `onSuccess` is restated: `SubmitFormParams` picks its signature by a conditional on the response,
// which stays unresolved for a generic one.
export type ValueFormParams<TBody, TResponse> = Omit<SubmitFormParams, 'onSuccess'> & {
  onSuccess?: (data: TResponse) => void
  /** The current value when renaming; blank when creating. */
  value?: string
  /** The endpoint's body schema, from `http-schemas` — create and update differ only in optionality. */
  schema: z.ZodType<TBody, ValueFormValues>
  /** The entity's create or update `mutateAsync`. */
  save: (body: TBody) => Promise<TResponse>
}

/**
 * Creates or renames an entity that is nothing but a unique `value`. A rename reaches every product
 * carrying it; line items keep the value they were sold with.
 */
export function useValueForm<TBody, TResponse>({
  value = '',
  schema,
  save,
  ...params
}: ValueFormParams<TBody, TResponse>) {
  const defaultValues: ValueFormValues = { value }

  const form = useAppForm({
    defaultValues,
    validators: { onSubmit: schema },
    onSubmit: async ({ value: values }) => {
      try {
        const data = await save(schema.parse(values))
        form.reset()
        params.onSuccess?.(data)
      } catch (error) {
        params.onError?.(errorMessage(error))
      } finally {
        params.onSettled?.()
      }
    },
  })

  return { form }
}
