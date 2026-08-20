# Form Hook Pattern

Form hooks extract form setup and mutation logic out of components. Components render fields; hooks own the form instance, validation, and submission. This pattern applies to both admin and store apps.

## Structure

```
features/{name}/
  hooks/use-{action}-form.ts   — form hook
  components/{action}-form.tsx  — renders fields, calls hook
```

## Hook shape

```ts
import { SomeSchema } from '@proteus/http-schemas/store' // or /admin
import type { SomeBody } from '#/api/generated/model'
import { useSomeMutation } from '#/features/{name}/api/{name}'
import type { SubmitFormParams } from '#/lib/form'
import { useAppForm } from '#/lib/form-hook'

export type SomeFormParams = SubmitFormParams & {
  defaultValues?: SomeBody
}

export function useSomeForm(params?: SomeFormParams) {
  const mutation = useSomeMutation()

  const form = useAppForm({
    defaultValues: params?.defaultValues ?? { field: '' },
    validators: { onSubmit: SomeSchema },
    onSubmit: async ({ value }) => {
      mutation.mutate(value, {
        onSuccess: () => params?.onSuccess?.(),
        onError: (error) => params?.onError?.(error.message),
        onSettled: () => params?.onSettled?.(),
      })
    },
  })

  return { form, isPending: mutation.isPending, error: mutation.error }
}
```

## Rules

### Types

- `defaultValues` typed with the **Orval-generated `Body` type** (e.g., `AddStoreCartShippingMethodBody`), not a hand-written type.
- If the form has extra fields not in any API body (e.g., `sameAsBilling`), use an intersection: `UpdateStoreCartBodyShippingAddress & { sameAsBilling: boolean }`.
- When Zod optional fields (`string | undefined`) conflict with form string defaults, use `satisfies T as T` on the defaults object to narrow the type.

### Validation

- Use the **Zod schema from `http-schemas` directly** as the validator — don't recreate it with `z.object()`.
- If the form has extra fields, use `.extend()` on the http-schema: `CartAddressInput.extend({ sameAsBilling: z.boolean() })`.
- If the form uses a subset of fields, use `.pick()`: `AdminCreateProduct.pick({ title: true, handle: true })`.

### Mutation callbacks

Use `.mutate()` with `onSuccess`/`onError`/`onSettled` callbacks — not `try/catch` with `mutateAsync`:

```ts
// Correct: single mutation
mutation.mutate(value, {
  onSuccess: () => params?.onSuccess?.(),
  onError: (error) => params?.onError?.(error.message),
  onSettled: () => params?.onSettled?.(),
})
```

**Exception:** when chaining multiple sequential mutations where the second depends on the first, use `try/catch` with `mutateAsync`:

```ts
// Correct: multiple sequential mutations
try {
  const first = await mutationA.mutateAsync(valueA)
  await mutationB.mutateAsync({ id: first.id, ...valueB })
  params.onSuccess?.()
} catch (e) {
  const message = e instanceof Error ? e.message : 'Operation failed'
  params.onError?.(message)
} finally {
  params.onSettled?.()
}
```

### Error handling

Error toasts are handled by the mutation hook layer (see `docs/mutation-hooks.md`), not the form hook. The form hook's `onError` callback is for notifying the caller (e.g., to keep a modal open) — it doesn't need to show a toast.

### Data queries don't belong in form hooks

Queries that fetch options for the UI (e.g., `useShippingOptions`, `usePaymentProviders`) belong in the **component**, not the hook. The hook only owns form state and mutations.

### SubmitFormParams

Both apps define the same `SubmitFormParams` type for consistent callback signatures:

```ts
export type SubmitFormParams<T = undefined> = {
  onSuccess?: T extends undefined ? () => void : (params: T) => void
  onError?: (error: string) => void
  onSettled?: () => void
}
```

Use the generic parameter when the caller needs the mutation response (e.g., `SubmitFormParams<AdminCreateProductResponse>`).

## Examples

| Hook | Schema | Body type | File |
|------|--------|-----------|------|
| `useShippingMethodForm` | `AddCartShippingMethod` | `AddStoreCartShippingMethodBody` | `apps/store/src/features/checkout/hooks/use-shipping-method-form.ts` |
| `useShippingAddressForm` | `CartAddressInput.extend(...)` | `UpdateStoreCartBodyShippingAddress & { sameAsBilling }` | `apps/store/src/features/checkout/hooks/use-shipping-address-form.ts` |
| `usePaymentForm` | `CreatePaymentSession` | `CreateStorePaymentSessionBody` (multi-mutation) | `apps/store/src/features/checkout/hooks/use-payment-form.ts` |
| `useCreateProductForm` | `productFormSchema` | `ProductFormValues` (multi-step) | `apps/admin/src/features/products/hooks/use-create-product-form.ts` |
| `useRegisterForm` | `StoreSignupBody` | inline | `apps/store/src/features/auth/hooks/use-register-form.ts` |
