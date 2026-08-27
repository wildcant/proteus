# 06 — Address book

`05` listed Address Book as blocked. It is less blocked than it looked: `CustomerModuleService`
already has the full CRUD — `listCustomerAddresses`, `createCustomerAddress`,
`updateCustomerAddress(es)`, `softDeleteCustomerAddresses` — and `customer_address` is modelled
with `isDefaultShipping` / `isDefaultBilling` and partial unique indexes enforcing one of each per
customer. What is missing is the HTTP layer and the UI.

This is the first redesign ticket that is mostly backend.

Depends on `05-account-page.md` (the panel that links here) and `01-token-foundation.md`.

## The reference

```
 ‹ Back to account                     ‹ Back to account

 ADDRESS BOOK                          ADDRESS BOOK

 ┌─────────────────────────┐           ┌──────────────────┐   YOUR ADDRESSES
 │   ＋  Add an address    │           │ ＋ Add an address│
 └─────────────────────────┘           └──────────────────┘   ADDRESS BOOK IS EMPTY
                                                              Add addresses to your address
 ADDRESS BOOK IS EMPTY                                        book and you'll be able to
 Add addresses to your address book                           checkout faster
 and you'll be able to checkout faster
```

Underlined "Back to account" with a `‹`, the page title in the display face, then a solid ink
button that is full-width on the phone and a third of the width on desktop. The empty state is two
lines of type — heading in the display face, one muted line under it — with no illustration and no
border. On desktop the button and the list are two columns; on the phone they stack, button first.

The reference renders the address form **inline in the right column** (`YOUR ADDRESSES` is replaced
by a bordered form panel). We are not copying that.

## Decisions

**The form is a route-driven drawer, not an inline panel.** Inline means the page is in one of two
modes and the shopper's place in the list is gone when the form opens; on the phone the list
disappears entirely, so "add an address" and "edit the third one" look identical once you are in
it. A drawer keeps the list behind it, and the route in the address bar says which of the two you
are doing. `apps/admin` already has exactly this in `RouteDrawer` / `RouteFocusModal` — see below.

**Child routes, not the `?modal=` param.** `src/lib/modal-state.ts` explains why search is a global
search param: it opens over the home page, the PLP, a PDP or the cart, so it has no single parent
route to nest under. Addresses do have one. `/account/addresses/new` and
`/account/addresses/$addressId/edit` nest under `/account/addresses` the way admin nests
`_detail/edit` under `_detail`, which gets deep-linking, hardware back and the unsaved-changes
guard without inventing anything.

**One "default" checkbox, two columns underneath.** The reference offers "Make this my main
address". The model keeps `isDefaultShipping` and `isDefaultBilling` separate, and it should — a
shopper who later needs a different billing address should not need a migration. But nobody thinks
in two defaults, so the form shows one checkbox and the endpoint sets both. Splitting them is a UI
change later, not a schema change.

**Keep `addressName`.** The column exists and the reference has no equivalent, but a list of four
addresses in the same city is unreadable without a label. Optional field, shown as the card's
heading when set and falling back to the recipient's name when not.

**`PATCH` and `DELETE` on the `[id]` route.** `apps/backend/src/api/store/carts/[id]/route.ts` uses
`POST` to update, inherited from Medusa's shape; `apps/backend/src/api/admin/customers/[id]/route.ts`
uses `PATCH` and `DELETE`. New store resources should follow the second — the cart's verb is a
legacy to contain, not a convention to spread.

## Moving the route-modal components to `packages/ui`

The store needs what `apps/admin/src/components/modals/` already has: `RouteFocusModal`,
`RouteDrawer`, `RouteModalForm` (the `useBlocker` unsaved-changes guard) and `RouteModalProvider`.
Rewriting them in the store would put a second copy of the blocker logic in the monorepo, and that
is the exact code that drifts.

**Move the folder to `packages/ui` behind a subpath export**, `@proteus/ui/route-modals`, rather
than adding it to the root entry. The components pull in `@tanstack/react-router`,
`@tanstack/react-store` and `@tanstack/form-core`, and `packages/ui` today depends on none of them
— it is a presentational library that works anywhere React does. A second entry point keeps that
true: importing `@proteus/ui` never reaches router code, and the import path itself documents that
this entry requires a router context. `package.json` already has an `exports` map with `.` and
`./styles.css`; this is a third key.

Three things to check while moving:

- **Admin imports.** `components/modals/index.ts` is imported across admin features; the move is a
  find-and-replace to `@proteus/ui/route-modals`, and admin's dependency-cruiser rules should be
  re-run rather than assumed.
- **SSR.** Both components open via `useEffect` on mount, so the drawer is closed in the SSR
  payload and opens after hydration. `/account` is under `_main`, which is `ssr: true`. That is
  acceptable — arguably right, since a drawer animating in on load is the intended effect — but it
  means the form is not in the server HTML and the ticket should not be surprised by that.
  `document.body.style` and `window.history` are only touched in event handlers, so nothing
  explodes during render.
- **Square corners.** `RouteFocusModal` hardcodes `rounded-lg` and a `shadow-lg`. Under the store's
  `--radius: 0rem` the radius resolves to zero on its own, but the shadow does not belong in a
  system with no other shadows — override it at the store's call site rather than changing the
  shared component out from under admin.

Use `RouteDrawer` rather than `RouteFocusModal`: nine fields in one column do not need the whole
viewport on desktop. It must go full-width below `sm`, which is a `--drawer-*` variable, not a new
component.

## Backend work

- **`packages/http-schemas/src/store/customer/`** — `StoreCustomerAddress` entity,
  `StoreCreateAddressBody`, `StoreUpdateAddressBody`, and the list/detail responses. Every field on
  the model except `metadata` and the two default flags is nullable; the create body should require
  the ones a courier actually needs (`address1`, `city`, `countryCode`, `postalCode`) rather than
  inheriting the model's nullability wholesale.
- **`src/api/store/customers/me/addresses/route.ts`** — `GET` (list, customer-scoped) and `POST`
  (create).
- **`src/api/store/customers/me/addresses/[id]/route.ts`** — `PATCH` and `DELETE`.
- **Ownership, on every `[id]` call.** `req.authContext.actorId` is the customer; the address must
  be loaded and its `customerId` compared before any write. Without that, `PATCH
  /store/customers/me/addresses/cuaddr_<someone-else>` edits a stranger's address, and the route
  name reads as if it could not. This is the single most important line in the ticket.
- **Default reassignment has to be transactional.** `liveUniqueIndex(... is_default_shipping = true)`
  means a second default for the same customer is a database error, not a last-write-wins. Setting
  a new default must clear the previous one in the same transaction — a service method on
  `CustomerModuleService` (`setDefaultAddress(customerId, addressId)`), not two calls from the
  route. Both indexes are partial and filtered on the live rows, so a soft-deleted default does not
  hold the slot.
- **Tests.** `apps/backend/src/api/store/customers/__tests__/` — the ownership check and the default
  swap are the two that must be able to fail. A test that only asserts a 200 on create proves
  nothing about either.

## Store work

- **`routes/_main/_authed/addresses.tsx`** — the page: back link, title, add button, and the list
  or the empty state. `<Outlet />` for the child routes.
- **`routes/_main/_authed/addresses/new.tsx`** and **`addresses/$addressId/edit.tsx`** — each a
  `RouteDrawer` around the shared form, mirroring `apps/admin/.../products/create.tsx`.
- **`features/account/components/address-form.tsx`** — one form for both, `RouteDrawer.Form` for the
  unsaved-changes guard. Fields via the existing `TextField`; country as a `NativeSelect`, the same
  control the checkout shipping form uses.
- **`features/account/components/address-card.tsx`** — name or label, address lines, a `Default`
  badge, edit and delete. Delete goes through an `AlertDialog`; a one-tap destructive action next
  to an edit link on a phone is a mis-tap waiting to happen.
- **`features/account/api/addresses.ts`** — query options plus the three mutation hooks, following
  `docs/mutation-hooks.md`.
- **`05`'s Address Book panel** — point it at `/account/addresses` and drop it from that ticket's
  Blocked list.

## Responsive

Phone-first: the base classes are the single column, `lg:` introduces the split.

- **Base (phone).** Back link, title, then the full-width ink `＋ Add an address` button, then the
  list or the empty state. Address cards are full-bleed within the page gutter, stacked, with edit
  and delete as a row beneath the address lines rather than crowded onto its right edge. The drawer
  is full-width and full-height, its footer buttons pinned so Save is reachable without scrolling
  back down.
- **`lg:` and up.** Two columns: the button in a narrow left column, `Your addresses` and the list
  on the right. Cards go two-up. The drawer is a right-side panel at its default width.
- The empty state stays in the right column on desktop and directly under the button on the phone —
  it is the same block either way, so nothing is duplicated.

## Blocked by nothing, and it unblocks something

`.tasks/next-todos` wants a "use a saved address" picker at checkout and names the missing address
endpoints as the reason it cannot exist. This ticket adds exactly those endpoints. The picker
itself is a separate ticket against `features/checkout`, and it should not be smuggled in here.

## Constraint

There is no e2e coverage of the account area at all — `05` is where the first test lands. Address
tests belong in the same file: one spec per feature, and the address book is part of the account
domain, not its own. Cover the round trip (add, appears in the list, edit, still there, delete,
gone) and the ownership check, which is the one failure a UI test cannot see.
