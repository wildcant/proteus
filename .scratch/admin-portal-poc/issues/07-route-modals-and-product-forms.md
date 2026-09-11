# 07 — Admin: Route-based modals and product forms

**What to build:** A reusable route-based modal system, then product create/edit forms on top of it. Phase 1 builds the modal infrastructure: install shadcn Drawer and AlertDialog into `@proteus/ui`, then build `RouteFocusModal`, `RouteDrawer`, `RouteModalForm`, `RouteModalProvider`, and `KeyboundForm` in the admin app. Phase 2 wires up product create and edit routes using those modal components with TanStack Form + Zod validation.

**Blocked by:** 04 -- DataTable system + Product list page, 06 -- Product detail page

**Status:** done

**Spec:** `.scratch/admin-portal-poc/modal-system-spec.md`

---

## Phase 1: Modal system infrastructure

### 1a. Install shadcn components into `@proteus/ui`

- [x] Run `pnpm dlx shadcn@latest add drawer alert-dialog` in `packages/ui` (adds `drawer.tsx` and `alert-dialog.tsx` to `packages/ui/src/components/ui/`)
- [x] Export all Drawer parts from `packages/ui/src/index.ts`: `Drawer`, `DrawerClose`, `DrawerContent`, `DrawerDescription`, `DrawerFooter`, `DrawerHeader`, `DrawerOverlay`, `DrawerPortal`, `DrawerSwipeHandle`, `DrawerTitle`, `DrawerTrigger`
- [x] Export all AlertDialog parts from `packages/ui/src/index.ts`: `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogMedia`, `AlertDialogOverlay`, `AlertDialogPortal`, `AlertDialogTitle`, `AlertDialogTrigger`
- [x] Verify `pnpm --filter frontend run typecheck` (or equivalent) still passes -- alert-dialog install may try to overwrite `button.tsx`, decline the overwrite

### 1b. RouteModalProvider -- context layer

Location: `apps/admin/src/components/modals/route-modal-provider/`

- [x] `route-modal-context.tsx` -- create context with `handleSuccess` and `setCloseOnEscape` (see spec: RouteModalProvider section)
- [x] `route-provider.tsx` -- provider implementation using `useNavigate()`, `handleSuccess` sets `isSubmitSuccessful: true` in router state before navigating, supports both string paths and numeric history offsets
- [x] `use-route-modal.tsx` -- `useRouteModal()` hook that throws if used outside provider

### 1c. RouteFocusModal -- full-screen bottom-up drawer

Location: `apps/admin/src/components/modals/route-focus-modal/route-focus-modal.tsx`

- [x] `Root` component wraps shadcn `Drawer` (default `swipeDirection="down"`) with controlled `open` state -- opens on mount via `useEffect`, navigates to parent on close
- [x] Wraps children in `RouteModalProvider`
- [x] `Content` sub-component renders `DrawerContent`, intercepts Escape key when `closeOnEscape` is false (for inline editing)
- [x] Compound API via `Object.assign`: `.Header` (DrawerHeader), `.Title` (DrawerTitle), `.Description` (DrawerDescription), `.Body` (scrollable div wrapper), `.Footer` (DrawerFooter), `.Close` (DrawerClose), `.Form` (RouteModalForm)
- [x] `Body` sub-component is a simple `<div className="flex-1 overflow-y-auto">` -- not provided by shadcn Drawer

### 1d. RouteDrawer -- right-side slide-in drawer

Location: `apps/admin/src/components/modals/route-drawer/route-drawer.tsx`

- [x] Same pattern as RouteFocusModal but with `swipeDirection="right"` on `Drawer`
- [x] Wraps children in `RouteModalProvider`
- [x] Compound API: `.Header`, `.Title`, `.Description`, `.Body` (with `px-4` padding), `.Footer`, `.Close`, `.Form`

### 1e. RouteModalForm -- unsaved changes guard

Location: `apps/admin/src/components/modals/route-modal-form/route-modal-form.tsx`

- [x] Accepts `form: ReactFormExtendedApi` (from `@tanstack/react-form`) -- reads dirty state via `form.useStore((s) => s.isDirty)`
- [x] Uses `useBlocker({ shouldBlockFn, withResolver: true, enableBeforeUnload })` from TanStack Router
- [x] `shouldBlockFn`: returns `false` when `isSubmitSuccessful` is in next location state (bypass after save), otherwise returns `isDirty && isPathChanged`
- [x] Optional `blockSearchParams` prop -- when true, also blocks on search param changes
- [x] Renders `AlertDialog` from `@proteus/ui` when `status === "blocked"` -- title: "You have unsaved changes", actions: Cancel (calls `reset()`), Continue (calls `proceed()`)
- [x] AlertDialog cannot be dismissed via Escape or overlay click -- forces explicit user choice

### 1f. KeyboundForm

Location: `apps/admin/src/components/modals/keybound-form.tsx`

- [x] Prevents form submission on bare Enter (avoids accidental submit)
- [x] Submits on `Cmd+Enter` (macOS) / `Ctrl+Enter` (Windows/Linux)
- [x] Allows normal Enter in `<textarea>` elements (newlines)
- [x] Accepts custom `onKeyDown` override prop

### 1g. Barrel export

Location: `apps/admin/src/components/modals/index.ts`

- [x] Export `RouteFocusModal`, `RouteDrawer`, `RouteModalForm`, `useRouteModal`, `KeyboundForm`

---

## Phase 2: Product create and edit forms

### 2a. Product create route + form

Route: `apps/admin/src/routes/_authed/_shell/products/create.tsx`
Form: `apps/admin/src/features/products/components/create-product-form.tsx`

- [x] `create.tsx` route renders `RouteFocusModal` wrapping `CreateProductForm`
- [x] `RouteFocusModal.Title` with `className="sr-only"` for accessibility (visual title is in the form body)
- [x] Form uses `useAppForm` from `#/lib/form-hook.ts` with:
  - `defaultValues: { title: "" }`
  - `validators: { onSubmit: AdminCreateProduct }` (from `@proteus/http-schemas`)
  - `onSubmit` calls `useCreateProduct().mutateAsync`, then `handleSuccess(\`../$\{data.product.id\}\`)` to navigate to the new product detail page
- [x] Form renders inside `RouteFocusModal.Form` (provides dirty-form blocking) and `KeyboundForm` (Cmd+Enter submit)
- [x] Single field: `<form.AppField name="title">` using the existing `TextField` component
- [x] Footer: Cancel (`RouteFocusModal.Close`) and Save (`<Button type="submit">`)
- [x] Add "Create" button to products list page that navigates to this route

### 2b. Product edit route + form

Route: `apps/admin/src/routes/_authed/_shell/products/$id/edit.tsx`
Form: `apps/admin/src/features/products/components/edit-product-form.tsx`

- [x] `edit.tsx` route renders `RouteDrawer` wrapping `EditProductForm`
- [x] `EditProductForm` receives `product` prop (loaded by parent route's `beforeLoad`)
- [x] Form uses `useAppForm` with:
  - `defaultValues: { title: product.title }` (pre-populated from existing data)
  - `validators: { onSubmit: AdminUpdateProduct }` (from `@proteus/http-schemas`)
  - `onSubmit` calls `useUpdateProduct(id).mutateAsync`, then `handleSuccess()` (navigates back to detail page)
- [x] Query invalidation happens in the existing `useUpdateProduct` hook (`onSuccess` in `products.ts`) -- no extra work needed
- [x] Form renders inside `RouteDrawer.Form` and `KeyboundForm`
- [x] Single field: `<form.AppField name="title">` using `TextField`
- [x] Footer: Cancel (`RouteDrawer.Close`) and Save (`<Button type="submit">`)
- [x] Add "Edit" action to product detail page that navigates to this route

### 2c. Route wiring

- [x] Products list `Outlet` -- the `products/route.tsx` already renders `<Outlet />`, so the create modal route will render inside it automatically
- [x] Product detail `Outlet` -- `products/$id/route.tsx` already renders `<Outlet />`, so the edit drawer route will render inside it automatically
- [x] Both modals are URL-addressable: navigating directly to `/products/create` or `/products/:id/edit` opens them
- [x] Both modals animate in on mount and out on close (handled by Drawer's built-in CSS transitions)

---

## Reference files

**Spec (implementation details, component APIs, code examples):**
- `.scratch/admin-portal-poc/modal-system-spec.md`

**Medusa source (structural reference -- adapt patterns, don't copy verbatim):**
- `medusa-source/packages/admin/dashboard/src/components/modals/route-drawer/route-drawer.tsx`
- `medusa-source/packages/admin/dashboard/src/components/modals/route-focus-modal/route-focus-modal.tsx`
- `medusa-source/packages/admin/dashboard/src/components/modals/route-modal-form/route-modal-form.tsx`
- `medusa-source/packages/admin/dashboard/src/components/modals/route-modal-provider/`

**Existing proteus code to build on:**
- `packages/ui/src/components/ui/sheet.tsx` -- existing Sheet shows the `@base-ui/react/dialog` wrapper pattern (Drawer follows the same structure with `@base-ui/react/drawer`)
- `apps/admin/src/components/form/text-field.tsx` -- TextField with `useFieldContext`, reuse as-is
- `apps/admin/src/lib/form-hook.ts` -- `useAppForm` hook with registered field components
- `apps/admin/src/lib/form-context.ts` -- `fieldContext`, `formContext`, `useFieldContext`
- `apps/admin/src/features/products/api/products.ts` -- `useCreateProduct`, `useUpdateProduct` mutation hooks (already exist)
- `packages/http-schemas/src/admin/product/payloads.ts` -- `AdminCreateProduct` (title required), `AdminUpdateProduct` (title optional)
- `apps/admin/src/routes/_authed/_shell/products/route.tsx` -- parent layout with `<Outlet />`
- `apps/admin/src/routes/_authed/_shell/products/$id/route.tsx` -- detail layout with `<Outlet />`
