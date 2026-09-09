# Form hooks

Form hooks extract form setup and mutation logic out of components. Components render fields; hooks
own the form instance, validation, and submission. This applies to both admin and store apps.

The components that render a form — the `<Form>` wrapper and the submit button — are next door in
[form components](../../../components/__docs__/form-components.md).

## Structure

```
features/{name}/
  hooks/use-{action}-form.ts    — form hook
  components/{action}-form.tsx  — renders fields, calls hook
```

## Shape

```ts
import { SomeSchema, type SomeBody } from '@proteus/http-schemas/store' // or /admin
import { useSomeMutation } from '#/features/{name}/api/{name}'
import { errorMessage, type SubmitFormParams } from '#/lib/form' // admin: '#/types/form'
import { useAppForm } from '#/lib/form-hook'

export type SomeFormParams = SubmitFormParams<SomeResponse> & {
  defaultValues?: SomeBody
}

export function useSomeForm(params?: SomeFormParams) {
  const mutation = useSomeMutation()

  const form = useAppForm({
    defaultValues: params?.defaultValues ?? { field: '' },
    validators: { onSubmit: SomeSchema },
    onSubmit: async ({ value }) => {
      try {
        const data = await mutation.mutateAsync(value)
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
```

## Rules

### The submit awaits its write

`onSubmit` is `async`, the write is `await mutation.mutateAsync(...)`, and the whole of it sits in
`try` / `catch` / `finally`. There is no second shape and no exception — a submit that writes twice
just has two `await`s in the same `try`.

The reason is `isSubmitting`. `FormApi.handleSubmit` sets it before calling `onSubmit` and clears it
when the returned promise settles, so awaiting the write is what makes it mean *"the request is
still in the air"*. A fire-and-forget `mutation.mutate()` returns immediately: the form counts
itself submitted while the request is still going, and the submit button — which reads nothing else
— hands itself back for a second press.

### The submit is guarded

A rejected `mutateAsync` propagates out of `handleSubmit`, which rethrows it; the `<Form>` wrapper
does not catch, so an unguarded write surfaces as an unhandled rejection rather than as the caller's
`onError`. The `catch` is what keeps a modal open on failure.

`finally` is where `onSettled` belongs, and it is only correct because the write is awaited. Mixing
the two — `mutate()` with callbacks *and* a `finally` — fires `onSettled` twice, one of them before
the request has landed.

`errorMessage(error)` turns the `unknown` a catch binding is typed as back into a string. It lives
beside `SubmitFormParams`. Don't hand-write `error instanceof Error ? … : '…'` per hook: the
fallback is unreachable — the fetcher only ever throws `Error` — and the message the merchant reads
is the toast the mutation hook raises, not this.

### The hook returns `{ form }`

No `isPending`, no `isLoading`. The form is the one place that knows whether a write is in flight,
and a hook that returns its own copy is a second thing to keep in step — the one that gets
forgotten. Where a label or a non-submit button needs it, subscribe:

```tsx
<form.Subscribe selector={(state) => state.isSubmitting}>
  {(isSubmitting) => <form.SubmitButton>{isSubmitting ? 'Signing in…' : 'Sign in'}</form.SubmitButton>}
</form.Subscribe>
```

Because everything the submit does is awaited inside `onSubmit`, `isSubmitting` covers more than the
request: `use-create-product-form` uploads media before it writes, and one flag spans both.

A hook may return more than the form when there is genuinely more — `useCheckoutForm` returns
`placeOrder`, `signOut`, `controller` and `paymentError`. None of those is an in-flight flag.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `form-hook-mutate-not-awaited` | the write is `await …mutateAsync`, never a fire-and-forget `mutate()` |
| `form-hook-submit-unguarded` | that `await` sits inside a `try` |
| `form-hook-returns-pending-flag` | the hook returns no in-flight flag of its own |

All three are scoped to `**/features/*/hooks/use-*form*.ts`. `ast-grep/README.md` covers how rules
run, how their tests work, and how to suppress one. None of these three has an exemption today.

## What is deliberately not enforced

- **Types.** `defaultValues` is typed with the **`http-schemas` `Body` type** (`AdminUpdateStoreBody`,
  `StoreLoginBody`) — the same module the validator comes from. Orval's generated types are for
  *responses* and entities, which is what `SubmitFormParams<T>` takes. Extra fields not in any API
  body use an intersection; where Zod optionals conflict with form string defaults, `satisfies T as T`
  narrows the defaults object. Too varied to match on, and the type checker already catches the
  mistakes that matter.
- **Validation.** Use the schema from `http-schemas` directly rather than recreating it with
  `z.object()`; `.extend()` for extra fields, `.pick()` for a subset, `.required({ … })` where a PATCH
  body's all-optional shape is wrong for a form editing the whole thing (`use-update-address-form`).
  Hand-writing a schema is for the cases with nothing to reuse, and the reason goes in a comment above
  it — the admin login route's body is the shared `AuthBody`, a `z.record(z.string(), z.string())` too
  loose to drive a form; the variant-image batch endpoints have no request body schema at all. A rule
  here would have to know which endpoint a form writes to.
- **Where the queries live.** A form hook owns form state and its one write, and reads nothing. Queries
  that fetch options for the UI go in the component that renders them — `useOptionCombinationSearch` in
  `create-variant-form.tsx` — or in the page's [data hook](./data-hooks.md) when more than one
  surface needs the same answer, which is how the checkout's sections get theirs. Expressible only as
  "no `useQuery` in this file", which would also refuse the legitimate cases a future form may have.
- **`SubmitFormParams`.** Both apps define the same type, and the generic carries the mutation response
  where the caller needs it (`SubmitFormParams<AdminCreateProductResponse>`). Duplicated rather than
  shared because neither app imports the other's lib; a rule would be checking two files are equal.

### A write that outlives its form

`mutateAsync` resolves whether or not the component is still mounted, unlike the per-call `mutate`
callbacks it replaced, which React Query drops on unmount. So a save the merchant walked away from
still reaches `params.onSuccess`, and for almost every form in admin that is `handleSuccess()` — a
navigation.

`RouteModalProvider` holds the guard, once, for all of them: `handleSuccess` returns early when the
modal has unmounted. The write and its cache invalidation have already happened by then; navigating
would only pull the merchant out of wherever they went. Nothing per-form is needed, and nothing
per-form should be added.

### One form across many sections

The store's checkout is one page with one button, so it is one form: `useCheckoutForm` owns the
schema, the defaults and the submit, and each section is a `withForm` component bound to
`checkoutFormOpts` — `ContactForm`, `ShippingAddressForm`, `ShippingMethodForm`, `PaymentForm`.
Sections render fields; none of them has a submit, a schema or a hook of its own.

A section that only *chooses* — a radio that writes on select — is not submitting, so its `mutate()`
stays a plain call in the component, with no button gated on it: `shipping-method-form.tsx` writes
the chosen option and resets the field if the write fails. The rules above are about submits; this
is not one, which is why their glob names hooks and not the components beside them.

## Examples

| Hook | Schema | Notes | File |
|------|--------|-------|------|
| `useEditStoreForm` | `AdminUpdateStore` | the plain shape, one write | `apps/admin/src/features/store/hooks/use-edit-store-form.ts` |
| `useCreateProductForm` | `productFormSchema` | multi-step; uploads media inside the same submit | `apps/admin/src/features/products/hooks/use-create-product-form.ts` |
| `useEditVariantMediaForm` | inline `z.object` | two sequential writes, one `try` | `apps/admin/src/features/products/hooks/use-edit-variant-media-form.ts` |
| `useCreateVariantForm` | `AdminCreateProductVariant.pick(...).extend(...)` | `z.input` defaults for a field the schema narrows | `apps/admin/src/features/products/hooks/use-create-variant-form.ts` |
| `useUpdateAddressForm` | `StoreUpdateAddress.required(...)` | PATCH body made required again for the form | `apps/store/src/features/address/hooks/use-update-address-form.ts` |
| `useCheckoutForm` | `checkoutSchema` | one page, one submit, several sections | `apps/store/src/features/checkout/hooks/use-checkout-form.ts` |

## Relationship with mutation hooks

Form hooks consume mutation hooks: the form hook awaits `mutateAsync` and the mutation hook raises
the error toast. The `onError` a form hook catches is for the caller, not for a second toast. See
[mutation hooks](../../api/__docs__/mutation-hooks.md).
