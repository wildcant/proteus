# Form components

The element a form is wrapped in, the fields inside it, and the button that submits it. The hook
behind them — where the schema, the defaults and the submit live — is in
[form hooks](../../features/hooks/__docs__/form-hooks.md).

## Structure

```
components/form/
  form.tsx           — the <Form> wrapper, one copy per app
  submit-button.tsx  — registered on the form hook as form.SubmitButton
  *-field.tsx        — one file per registered field, reached as field.TextField
lib/
  form-hook.ts       — the registration: fieldComponents and formComponents
```

The two apps register different sets, because they ask for different things: the store has
`TextField`, `SelectField`, `CheckboxField` and `CountryField`; the admin adds `TextareaField`,
`SwitchField`, `SingleComboboxField`, `NumberField` and `FileUploadField`.

## Shape

```tsx
<Form onSubmit={form.handleSubmit} className="flex flex-col gap-4">
  <form.AppForm>
    <form.AppField name="email">{(field) => <field.TextField label="Email" type="email" />}</form.AppField>
    <form.SubmitButton size="sm">Save</form.SubmitButton>
  </form.AppForm>
</Form>
```

## Rules

### Every form is wrapped

`<Form>` carries `noValidate`, and that is why it exists: fields carry `type="email"` and
`type="tel"` for the right mobile keyboard, which also opts them into the browser's own constraint
validation. That interrupts submit with a native bubble ("Please include an '@' in the email
address") instead of the field error the Zod schema produces — two validators and two error styles
for one mistake.

It owns the `preventDefault` too, and calls `onSubmit` with no arguments, which is what lets the
caller pass a bare `form.handleSubmit`; on a raw `<form>` that same reference receives the
SubmitEvent as TanStack's `submitMeta`.

Admin's route modals are the exception: they use `KeyboundForm` from `@proteus/ui`, which owns the
same `preventDefault` plus the ⌘+Enter binding a drawer needs.

### The `Field` suffix is reserved

A component named `*Field` is one of the components registered under `fieldComponents` in
`src/lib/form-hook.ts`. Nothing else may carry the suffix. A control that manages its own state gets
a different noun — `*Form`, `*Input`, `*Picker` — which is why the header search is `SearchForm` and
the region editor's locale input is `CountryLocaleInput`.

The suffix is a type signal rather than decoration: `form.AppField`'s children are exactly the
registered set, so a `SomethingField` that cannot be passed there sends a reader looking for a
`useFieldContext()` consumer that does not exist. Registered fields take no `value` and no
`onChange`; they read both from the context, which is what the rule below looks for.

### Submit comes from the form hook

`form.SubmitButton` has to sit inside `<form.AppForm>`: that is what provides the form context it
subscribes to. **It takes no props but its own appearance** — no `disabled`, and no in-flight flag
either. It subscribes to `isSubmitting`, which the hook's
[awaited submit](../../features/hooks/__docs__/form-hooks.md#the-submit-awaits-its-write) makes
truthful, so there is nothing left to pass and nothing to forget.

### Submit is never gated on validity

A submit button is never disabled because the form is incomplete, invalid or unchanged. A greyed-out
button is a dead end: it withholds the submit *and* the reason, so the merchant is left comparing
fields to work out which one it is unhappy about. Let the submit run, let the validator refuse it,
and let the offending field say so.

```tsx
// Correct — the schema refuses it and the field renders the message.
<form.SubmitButton size="sm">Save</form.SubmitButton>

// Wrong — nothing on screen says which country is missing its locale.
<Button type="submit" size="sm" disabled={!assignmentIsComplete(countries)}>Save</Button>
```

"Data has not loaded yet" is not a reason either. `create-variant-form` renders while its combination
list is still arriving; pressing Save then is refused by the schema with *"Pick a combination."* on
the field, which is a better answer than a button that will not say why.

Neither is "nothing has changed yet": submitting an unchanged form should be a no-op that closes it,
which is what `variant-price-edit-form.tsx` does when `buildPricePayload` finds nothing to send.

A form with **nothing to submit at all** is the one case that looks like an exception and isn't. When
every combination of a product's options already has a variant there is no valid input left, so
`create-variant-form.tsx` renders no submit — the footer's actions give way to an informational note
saying why, in blue. Withholding the button because the form is empty of possibilities is honest;
withholding it because the merchant has not filled it in correctly yet is not.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `form-element-not-wrapped` | a form is `<Form>` or `KeyboundForm`, never a bare `<form>` |
| `submit-button-not-from-form-hook` | submit is `form.SubmitButton`, not a raw `<Button type="submit">` |
| `submit-button-gated-by-validity` | a `disabled` on a submit is an in-flight flag and nothing else |
| `field-suffix-without-field-context` | a `*Field` component reads `useFieldContext()` |

`ast-grep/README.md` covers how rules run, how their tests work, and how to suppress one.

### Exemptions

Two forms cannot use `form.SubmitButton`, and both keep a raw submit:

- `variant-price-edit-form.tsx` drives a grid from `useState`, so there is no form context to read.
  It keeps `<Button type="submit" disabled={updatePrices.isPending}>` — an in-flight flag, which is
  the one shape `submit-button-gated-by-validity` allows.
- `create-product-form.tsx` has a footer holding two saves with different intents and a tab-advance,
  so none of them can be *the* submit. They are `type="button"` and read `isSubmitting` through
  `form.Subscribe`, like everything else.

Both are exempted by name in `submit-button-not-from-form-hook`'s `ignores` rather than by an inline
suppression: a JSX match cannot carry one, because ast-grep reads the suppression off the matched
node's preceding sibling and tree-sitter puts a `jsx_text` node holding the newline between a
`{/* … */}` and the element below it. `ast-grep/README.md` has the detail. An `ignores` glob exempts
a whole file and `--error=unused-suppression` cannot tell you when it goes stale, so keep it as
narrow as the one file it is for.

## What is deliberately not enforced

- **That a `*Field` is actually registered.** The rule checks the half a single file can see — that
  the component reads `useFieldContext()` — not that `form-hook.ts` lists it. A cross-file lookup is
  outside what an ast-grep rule can express, and the half it does check is the one that goes wrong:
  the suffix gets borrowed by a self-managed control, never by a context consumer somebody forgot to
  register. A field that reads the context and is not registered fails at its first use site instead.

- **Fields have to render their errors.** For any of the above to be worth anything, a refused submit
  has to show up somewhere. The `field.*` components do it already; a custom control takes an `errors`
  prop and renders `<FieldError>` itself, as `StoreRegionSelect` and `CurrencySelect` do:

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

  "Renders its own errors" is not a shape — a control can take the prop and drop it — which is the
  reason it is written down here instead.

- **Where an array's errors land.** When the invalid value is inside an array, the message belongs on
  the row, not on the list. A form-level standard-schema validator keys its issues by path —
  `countries[2].localeCode` — and a field opened at that exact path receives them, so a control that
  renders rows binds to the form with `withForm` and opens one field per row rather than taking a value
  and an `onChange`. See `country-locale-select.tsx`. It is the same reason the checkout's sections
  bind with `withForm` rather than taking values as props.

## Relationship with form hooks

The button reads `isSubmitting`; the hook is what makes that flag mean something. Neither half stands
up alone — see [form hooks](../../features/hooks/__docs__/form-hooks.md).
