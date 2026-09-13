# Route modals

Every create and edit form in the admin opens as a **route**, rendered in a `RouteFocusModal` or a
`RouteDrawer`. This covers writing one: where the route goes, which wrapper to use, the
unsaved-changes guard, and how a save closes it. The form's own contents — its fields, its submit
button, the hook behind them — are [form components](./form-components.md) and
[form hooks](../../features/hooks/__docs__/form-hooks.md).

Nothing here applies to the storefront. It reaches the same payoffs with a search param instead,
because its overlays have no parent page to be a child of.
[ADR-0019](../../../../../docs/adr/0019-modals-are-url-state.md) is the decision covering both, and
the half that explains why a modal is URL state at all; it describes none of the mechanism below.

## Structure

```
packages/ui/src/route-modals/
  route-focus-modal/route-focus-modal.tsx   — full-viewport takeover, opens upward
  route-drawer/route-drawer.tsx             — right-hand side panel, `default` and `wide`
  route-modal-form/route-modal-form.tsx     — the unsaved-changes blocker, exposed as `.Form`
  route-modal-provider/                     — handleSuccess + closeOnEscape, mounted by both wrappers
  keybound-form.tsx                         — the <form> element a modal uses
  router-types.ts                           — history-state typing for the success flag
```

`@proteus/ui` exports `RouteFocusModal`, `RouteDrawer`, `RouteModalForm`, `KeyboundForm` and
`useRouteModal`. The provider itself is not exported: the only way to get it is to render one of the
two wrappers, which is what keeps `useRouteModal()` from being callable outside one.

Both wrappers carry the same compound surface — `.Header`, `.Title`, `.Description`, `.Body`,
`.Footer`, `.Close`, `.Form` — and both are the same `Drawer` primitive underneath, differing in
swipe direction and size.

In the app the two halves sit apart, as everywhere else: the route file is thin and lives under
`src/routes/`; the form is a component in the feature that owns the record.

```
routes/_authed/settings/regions/$id/_detail/edit.tsx   — the route: params, loader, wrapper
features/regions/components/edit-region-form.tsx       — the form: fields, submit, close
```

## Shape

```tsx
// routes/_authed/settings/regions/$id/_detail/edit.tsx
export const Route = createFileRoute('/_authed/settings/regions/$id/_detail/edit')({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(regionQueryOptions(params.id)),
  component: EditRegionRoute,
})

function EditRegionRoute() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(regionQueryOptions(id))

  return (
    <RouteDrawer>
      <EditRegionForm region={data.region} />
    </RouteDrawer>
  )
}
```

```tsx
// features/regions/components/edit-region-form.tsx
export function EditRegionForm({ region }: { region: AdminRegion }) {
  const { handleSuccess } = useRouteModal()
  const { form } = useEditRegionForm(region, { onSuccess: () => handleSuccess() })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col">
        <form.AppForm>
          <RouteDrawer.Header>
            <RouteDrawer.Title>Edit Region</RouteDrawer.Title>
          </RouteDrawer.Header>
          <RouteDrawer.Body className="flex flex-col gap-y-6">{/* fields */}</RouteDrawer.Body>
          <RouteDrawer.Footer>
            <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteDrawer.Close>
            <form.SubmitButton size="sm">Save</form.SubmitButton>
          </RouteDrawer.Footer>
        </form.AppForm>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
```

## Rules

### Editing over a page means a child route, and the page has to render an `<Outlet />`

A route renders *in place of* its parent, not on top of it. The only reason the region detail page is
still painted behind its edit drawer is that `edit.tsx` is a child of `_detail/route.tsx`, the layout
route rendering that page — and that the layout renders an outlet for it to appear in.

**It does not render that outlet itself.** `PageLayout.SingleColumn` and `PageLayout.TwoColumn` both
render `<Outlet />` after their children, and that is the whole mechanism. A detail page built out of
neither, with no `<Outlet />` of its own, cannot host a nested modal at all: the child route mounts
nothing.

So an edit modal is three things agreeing — a layout route for the page, a `PageLayout.*` inside it,
and the modal route beneath. Getting one wrong does not look like a mistake in the file tree.

### Creating from a list replaces the list, and that is fine

`products/create.tsx` is a **sibling** of `products/index.tsx`, under a pathless layout route that is
nothing but an `<Outlet />`. Navigating to it unmounts the list. The focus modal animates in over an
empty page, which is indistinguishable from an overlay because it covers the viewport anyway.

Do not "fix" this by making create a child of the list. The list has no state worth keeping mounted —
its state is in the URL, which survives — and a full-viewport create form is the one case where
nothing shows through. This is why create flows are `RouteFocusModal` and edit flows over a detail
page are `RouteDrawer`.

### Closing is a navigation, and `prev` is what it navigates to

Both wrappers default `prev` to `'..'` and close with `navigate({ to: prev, replace: true })`.
`replace` is deliberate: opening pushed a history entry, and closing consumes it rather than leaving
one for a forward navigation to re-enter.

`'..'` is a path, not "the page that opened me". Set `prev` explicitly whenever the two differ —
`products/$id/variants/create` resolves `..` to `/products/$id/variants`, which is not a page, so it
passes `prev={`/products/${id}`}`. Getting this wrong does not error; it lands the merchant on a
route with no component.

### A save closes the modal through `handleSuccess`, never `navigate`

```tsx
const { handleSuccess } = useRouteModal()
const { form } = useEditRegionForm(region, { onSuccess: () => handleSuccess() })
```

`handleSuccess` writes `isSubmitSuccessful` into history state before navigating, and that flag is the
only thing that lets a *dirty* form close without the unsaved-changes prompt — the save just
succeeded, so there is nothing to warn about. Navigating by hand means asking the merchant whether to
discard changes they have already saved.

It takes a path when the save should land somewhere other than back: creating a product goes to the
product it created, `handleSuccess(`../${data.product.id}`)`.

Closing without saving is not its job. That is `.Close`, which the wrapper already wires.

### The guard is opt-in, and it is the `.Form` wrapper

Rendering inside a `RouteFocusModal` buys no dirty-state protection. `<RouteFocusModal.Form form={form}>`
is what adds it, and it needs a real TanStack Form instance to read `isDirty` from — so a form driven
by `useState` has no guard and cannot have one. `variant-price-edit-form.tsx` is that case: a price
grid in local state, no `.Form`, closing discards silently.

Given a form instance, wrap it: `.Form` outside, `KeyboundForm` inside. The blocker has to stay
mounted while its prompt is open, so inverting them puts the prompt inside the element it is
guarding.

The prompt is an `AlertDialog` with no Escape and no overlay dismiss — Cancel resets the blocker and
stays, Continue proceeds and the edits are gone. `enableBeforeUnload` extends the same guard to a tab
close. It blocks on a **pathname** change only; a search-param change passes straight through unless
the caller sets `blockSearchParams`, which nothing does, and which a modal containing a paged table
of its own would specifically not want.

### `KeyboundForm`, not `<Form>`

A modal's form element is always `KeyboundForm`. A bare Enter in a text input is suppressed, ⌘/Ctrl+Enter
submits, and Enter in a `<textarea>` still makes a newline — which is what a dense drawer full of
fields needs and what the app-level `<Form>` does not do. See
[form components](./form-components.md) for the wrapper rule generally.

### The header holds the title in a drawer, and nothing in a focus modal

`RouteDrawer.Header` takes a visible `.Title`; all eight usages do. `RouteFocusModal.Header` is
rendered empty — `<RouteFocusModal.Header />` — and the heading goes in `.Body` as a plain `<h1>`,
because a full-viewport form reads as a page rather than as a chrome bar with a label on it. Its
`.Title` appears only as `sr-only`, supplying the accessible name the dialog needs.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| *(none)* | — |

No rule under `standards/rules/` checks anything on this page. Two claims are held elsewhere:

### Already enforced, somewhere that is not here

| Claim | Held by |
|---|---|
| A modal's form element is not a bare `<form>` | `form-element-not-wrapped` — the `standards` gate. It bans the literal element everywhere and exempts `keybound-form.tsx` itself. It does **not** distinguish `KeyboundForm` from `<Form>`: a modal using the wrong wrapper passes |
| The guard fires, and `prev` lands on a real page | `apps/admin/tests/e2e/products.spec.ts` — the variant-create journey half-fills the form, cancels, asserts *"You have unsaved changes"*, confirms, and waits for `/products/${id}` rather than the `/variants` segment that is not a page |

`standards/README.md` covers how rules run, how their tests work, and how to suppress one.

## What is deliberately not enforced

- **That an edit modal's route is a child of a layout rendering an outlet.** The claim most worth
  checking and the one furthest out of reach: it spans three files and a directory layout — which
  route is whose parent, and whether that parent's component eventually renders `<Outlet />` through a
  `PageLayout.*`. No rule sees a route tree, and the generated `routeTree.gen.ts` records the parent
  without recording whether an outlet is reached.

- **That `onSuccess` calls `handleSuccess`.** A form hook's `onSuccess` is an arbitrary callback and a
  toast-only one is legitimate — `invite-form.tsx` stays open after sending, because the next invite
  is the likely next action. "Closes the modal" cannot be required of every callback, only of the
  forms that mean to close.

- **The wrapper order.** `.Form` inside `KeyboundForm` type-checks; both take children and neither
  knows about the other. A rule matching the nesting would have to resolve which compound namespace
  `.Form` came from, which is a cross-file lookup ast-grep does not do.

- **That a form with a form instance wraps it in `.Form`.** The exception is real — a `useState` grid
  cannot — so the check would need to know whether a TanStack Form exists in the component, and the
  answer lives in the feature hook the component calls.

## Examples

| File | Why look at it |
|---|---|
| `routes/_authed/settings/users/invite.tsx` + `features/users/components/invite-form.tsx` | the floor — one field, a focus modal, deliberately no close on success |
| `routes/_authed/settings/regions/$id/_detail/edit.tsx` | a drawer as a child of a layout route, with a loader priming the query the form reads |
| `routes/_authed/_shell/products/$id/variants/create.tsx` | an explicit `prev`, because `..` is not a page |
| `routes/_authed/_shell/products/$id/_detail/images/$imageId/variants.tsx` | `size="wide"`, the drawer width that fits a data table |
| `features/products/components/variant/variant-price-edit-form.tsx` | the two exceptions together — no `.Form` guard, and `setCloseOnEscape(false)` while a grid cell is mid-edit so Escape leaves the cell rather than the modal |

## Relationship with data tables

A list's toolbar `actions` and its `rowActions` are what open these, and both navigate rather than
set state — see [data tables](./data-tables.md).
