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

### The form element

Every form is wrapped in `<Form>` — `components/form/form.tsx`, one copy per app. It carries
`noValidate`, and that is why it exists: fields carry `type="email"` and `type="tel"` for the right
mobile keyboard, which also opts them into the browser's own constraint validation. That interrupts
submit with a native bubble ("Please include an '@' in the email address") instead of the field
error the Zod schema produces — two validators and two error styles for one mistake. It owns the
`preventDefault` too, and calls `onSubmit` with no arguments, which is what lets the caller pass a
bare `form.handleSubmit`; on a raw `<form>` that same reference receives the SubmitEvent as
TanStack's `submitMeta`.

```tsx
<Form onSubmit={form.handleSubmit} className="flex flex-col gap-4">
  <form.AppForm>…</form.AppForm>
</Form>
```

Admin's route modals are the exception: they use `KeyboundForm` from `@proteus/ui`, which owns the
same `preventDefault` plus the ⌘+Enter binding a drawer needs. `form-element-not-wrapped` fails a
bare `<form>` in either app.

### Submit is always enabled

A submit button is never disabled because the form is incomplete, invalid or unchanged. A greyed-out
button is a dead end: it withholds the submit *and* the reason, so the merchant is left comparing
fields to work out which one it is unhappy about. Let the submit run, let the validator refuse it,
and let the offending field say so.

Both apps register a `SubmitButton` form component that has this built in — it has no `disabled`
prop to pass, and disables itself only while the request is in flight. Use it rather than a raw
`<Button type="submit">`:

```tsx
// Correct — the schema refuses it and the field renders the message.
<form.AppForm>
  <form.SubmitButton size="sm">Save</form.SubmitButton>
</form.AppForm>

// Wrong — nothing on screen says which country is missing its locale.
<Button type="submit" size="sm" disabled={!assignmentIsComplete(countries)}>Save</Button>
```

`form.SubmitButton` has to sit inside `<form.AppForm>`: that is what provides the form context it
subscribes to. Where the hook returns the mutation's own flag, pass it as `isPending` — the form
counts itself submitted the moment `mutation.mutate()` returns, which is while the request is still
in the air, so `isSubmitting` alone would leave a window for a second press.

Two rules hold this up. `submit-button-not-from-form-hook` fails a raw `<Button type="submit">`
anywhere in either app, and `submit-button-gated-by-validity` fails a `disabled` that is not an
in-flight flag — the shape `SubmitButton` itself uses, and the only one left for a form that cannot
use it.

`variant-price-edit-form.tsx` is that form: it drives a grid from `useState`, so there is no form
context for `form.SubmitButton` to read, and it keeps a plain `<Button type="submit"
disabled={updatePrices.isPending}>`. It is exempted by name in the rule's `ignores`, because a JSX
match cannot carry an inline suppression — see `ast-grep/README.md`.

For this to be worth anything the field has to render its errors. The `field.*` components do it
already; a custom control takes an `errors` prop and renders `<FieldError>` itself, as
`StoreRegionSelect` and `CurrencySelect` do:

```tsx
<form.Field name="currencyCodes">
  {(field) => (
    <CurrencySelect
      value={field.state.value}
      onChange={field.handleChange}
      errors={field.state.meta.isValid ? undefined : field.state.meta.errors}
    />
  )}
</form.Field>
```

When the invalid value is inside an array, the message belongs on the row, not on the list. A
form-level standard-schema validator keys its issues by path — `countries[2].localeCode` — and a
field opened at that exact path receives them, so a control that renders rows binds to the form
with `withForm` and opens one field per row rather than taking a value and an `onChange`. See
`country-locale-select.tsx`.

"Nothing has changed yet" is not a reason to disable either: submitting an unchanged form should
be a no-op that closes it, which is what `variant-price-edit-form.tsx` does when
`buildPricePayload` finds nothing to send.

A form with **nothing to submit at all** is the one case that looks like an exception and isn't. When
every combination of a product's options already has a variant there is no valid input left, so
`create-variant-form.tsx` renders no submit — the footer's actions give way to an informational note
saying why, in blue. Withholding the button because the form is empty of possibilities is honest;
withholding it because the merchant has not filled it in correctly yet is not.

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
| `useContactForm` | `z.object({ email })` | `UpdateStoreCartBody` (commit on blur, no submit) | `apps/store/src/features/checkout/hooks/use-contact-form.ts` |
| `useShippingAddressForm` | `UpdateCart.pick(...).extend(...)` | `UpdateStoreCartBodyShippingAddress & { sameAsBilling }` | `apps/store/src/features/checkout/hooks/use-shipping-address-form.ts` |
| `usePlaceOrder` | none — nothing to validate | three sequential mutations behind one button | `apps/store/src/features/checkout/hooks/use-place-order.ts` |
| `useCreateProductForm` | `productFormSchema` | `ProductFormValues` (multi-step) | `apps/admin/src/features/products/hooks/use-create-product-form.ts` |
| `useRegisterForm` | `StoreSignupBody` | inline | `apps/store/src/features/auth/hooks/use-register-form.ts` |

### Sections with no submit

The store's checkout is one page with one button, so its sections have no submit of their own. The
hook still owns everything that is not rendering: `useContactForm` and `useShippingAddressForm`
expose a `commit` that the section hangs on a bubbled `focusout`, and a `validate` the page's one
button calls to mark fields it does not render. A section that only *chooses* — a radio that writes
on select — has no form at all, and its mutation goes in a plain hook beside them rather than in
the component: see `use-shipping-method-choice.ts`.
