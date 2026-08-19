# Store Layout Refactor & Cart Feature Spec

## Overview

Refactor the store app (`apps/store`) to adopt Medusa storefront layout decisions while keeping the existing SPA architecture (TanStack Start + Router + React Query), bulletproof-react folder structure, and `@proteus/ui` component library. Add a fully working cart feature with add-to-cart, cart page, and cart dropdown. Leave checkout as a layout skeleton only.

## Scope

**In scope:**
- Route tree restructure (layout routes for main vs checkout)
- New Nav: sticky 3-column (hamburger | logo | cart), mobile menu via Sheet
- New Footer: placeholder link columns + copyright
- Cart feature: API hooks, cart ID persistence, add-to-cart on product detail, cart page, cart dropdown
- Backend: add totals to cart response
- Checkout layout skeleton (minimal header, no nav/footer, no checkout logic)

**Out of scope:**
- Checkout flow (payment, shipping, address forms)
- Product categories and collections
- Multi-language / countryCode routing
- CartMismatchBanner, FreeShippingNudge, Suspense boundaries
- Changes to `@proteus/ui` package itself (override styles in store app only)

---

## 1. Backend: Cart Totals

### Problem
`StoreCart` has no computed totals. Line items have `unitPrice` and `quantity` but the cart response has no `subtotal`, `shippingTotal`, or `orderTotal`.

### Solution
Add computed totals to the cart detail response, matching the pattern already used by orders (`StoreOrderTotals`).

**Cart detail response shape after change:**
```ts
type StoreCartDetailResponseCart = StoreCart & {
  items: StoreCartLineItem[]
  shippingMethods: StoreCartShippingMethod[]
  totals: {
    itemsTotal: string     // sum of (unitPrice * quantity) for all items
    shippingTotal: string  // sum of shipping method costs
    cartTotal: string      // itemsTotal + shippingTotal
  }
}
```

**Where:** Backend cart module — compute totals in the service or as a serialization step in the API route. Add a Zod schema in `packages/http-schemas` for `StoreCartTotals`. Regenerate Orval clients after.

---

## 2. Route Tree Restructure

### Current
```
routes/
  __root.tsx          <- Header + Footer hardcoded in RootDocument
  index.tsx
  login.tsx
  forgot-password.tsx
  reset-password.tsx
  verify.tsx
  products/
    route.tsx
    index.tsx
    $productId.tsx
  _authed/
    route.tsx
    account.tsx
```

### Target
```
routes/
  __root.tsx              <- html/body shell only. NO Header/Footer.
  _main/
    route.tsx             <- Nav + children + Footer
    index.tsx             <- Home (move from routes/index.tsx)
    login.tsx             <- Login (move from routes/login.tsx)
    forgot-password.tsx   <- (move)
    reset-password.tsx    <- (move)
    verify.tsx            <- (move)
    cart.tsx              <- Cart page (NEW)
    products/
      route.tsx           <- Outlet (move)
      index.tsx           <- Product list (move)
      $productId.tsx      <- Product detail (move, add "Add to cart")
    _authed/
      route.tsx           <- Auth guard (move, same logic)
      account.tsx         <- Account page (move)
      orders/
        index.tsx         <- Order list (future)
        $orderId.tsx      <- Order detail (future)
  _checkout/
    route.tsx             <- Minimal header: "Back to cart" link + "Proteus" logo
    index.tsx             <- Placeholder "Checkout coming soon"
```

### Key changes

**`__root.tsx`:**
- Remove `<Header />` and `<Footer />` from `RootDocument`
- Keep: `<html>`, theme init script, `<HeadContent>`, `<body>`, devtools, `<Toaster>`, `<Scripts>`
- Body renders only `{children}` (the `<Outlet />` from `RootComponent`)

**`_main/route.tsx`:**
- Renders `<Nav />` + `<Outlet />` + `<Footer />`
- No data fetching in the layout itself

**`_checkout/route.tsx`:**
- Renders a minimal header bar: back-to-cart link (left), "Proteus" logo (center), empty (right)
- Renders `<Outlet />`
- No Nav, no Footer

**URL paths unchanged:** Layout routes (`_main`, `_checkout`, `_authed`) use underscore prefix so they don't appear in URLs. `/login` stays `/login`, `/account` stays `/account`, `/cart` stays `/cart`.

---

## 3. Nav Component

Replace `src/components/Header.tsx` with a new `Nav` component.

### Layout
Sticky header (`sticky top-0 z-50`), 3-column flexbox:

```
[Hamburger]          [Proteus]          [Cart icon (count)]
  (left)              (center)              (right)
```

### Desktop (>= 640px)
- **Left:** Hamburger button opens Sheet (side menu)
- **Center:** "Proteus" text logo, links to `/`
- **Right:** Cart icon with item count badge + CartDropdown (Popover)

### Mobile (< 640px)
- **Left:** Hamburger button opens Sheet (side menu)
- **Center:** "Proteus" text logo
- **Right:** Cart icon with item count badge, links directly to `/cart` (no popover)

### Side Menu (Sheet, side="left")
Uses `@proteus/ui` `Sheet` component.

Contents:
- Close button (top right)
- Navigation links: Home, Products, Account, Cart
- ThemeToggle (moved from current header)
- Copyright line at bottom

### Styling
- Keep Proteus design tokens (sea-ink, lagoon, etc.)
- Header background: `var(--header-bg)` with `backdrop-blur-lg`
- Border bottom: `var(--line)`
- Container: `page-wrap` class for consistent max-width

### Component location
`src/components/nav/` directory:
- `nav.tsx` — main Nav component
- `side-menu.tsx` — Sheet-based mobile/desktop menu
- `cart-dropdown.tsx` — desktop cart popover (see section 6)

---

## 4. Footer Component

Replace `src/components/Footer.tsx`.

### Layout
3-column grid of placeholder links + copyright row.

```
[Shop]              [Help]              [Company]
  Home                FAQ                 About
  Products            Contact             ...
  Cart                ...

(c) 2026 Proteus. All rights reserved.
```

### Details
- Responsive: stacks vertically on mobile, 3-col grid on desktop
- Links are placeholder `<Link>` elements pointing to `/` or `#` for now
- Copyright row spans full width below the grid
- Background: subtle border-top with `var(--line)`
- Container: `page-wrap`

### Component location
`src/components/footer.tsx` (overwrite existing)

---

## 5. Cart Feature

### 5a. Cart ID Persistence

**File:** `src/lib/cart-id.ts`

```ts
const CART_ID_KEY = 'proteus_store_cart_id'

getCartId(): string | null
setCartId(id: string): void
clearCartId(): void
```

localStorage-based, same pattern as `auth-token.ts`.

### 5b. Cart API Hooks

**File:** `src/features/cart/api/cart.ts`

Following the existing pattern from `features/products/api/products.ts`:

**Queries:**
- `cartQueryOptions(cartId)` — `getStoreCart(cartId)`, returns cart with items + totals
- `useCart()` — reads cart ID from localStorage, returns cart data. Returns `null` if no cart ID.

**Mutations:**
- `useCreateCart()` — `createStoreCart()`, stores returned ID via `setCartId()`
- `useAddToCart()` — `addStoreCartLineItem(cartId, body)`, invalidates cart query
- `useUpdateLineItem()` — `updateStoreCartLineItem(cartId, lineId, body)`, invalidates cart query
- `useRemoveLineItem()` — `deleteStoreCartLineItem(cartId, lineId)`, invalidates cart query

All mutations invalidate `cartKeys.detail(cartId)` on success.

**Helper:**
- `useCartId()` — hook that reads cart ID from localStorage with state, so components re-render when cart is created

### 5c. Add to Cart (Product Detail Page)

**Modify:** `src/routes/_main/products/$productId.tsx`

Add to the product detail page:
- Variant selector (if product has variants with options)
- Quantity selector (default 1, range 1-10)
- "Add to cart" button
- Uses `useAddToCart()` mutation
- If no cart exists yet, creates one first via `useCreateCart()`, then adds item
- Shows toast on success ("Added to cart")
- Button shows loading state during mutation

**Component:** `src/features/cart/components/add-to-cart.tsx`
- Receives product and selected variant
- Handles create-cart-if-needed + add-item flow
- Quantity input

### 5d. Cart Page

**Route:** `src/routes/_main/cart.tsx`

**Layout:** 2-column on desktop (items left, summary right), single column on mobile.

**Left column — Cart items:**
- List of line items, each showing:
  - Product thumbnail (placeholder image if none)
  - Product title + variant title
  - Unit price
  - Quantity selector (1-10, uses `useUpdateLineItem()`)
  - Line total (unitPrice * quantity, computed client-side; or from backend if available)
  - Remove button (uses `useRemoveLineItem()`)
- Sorted by `createdAt` descending (newest first)
- Empty state: "Your cart is empty" + link to `/products`

**Right column — Summary:**
- Items total (from `cart.totals.itemsTotal`)
- Shipping total (from `cart.totals.shippingTotal`, or "Calculated at checkout")
- Cart total (from `cart.totals.cartTotal`)
- "Go to checkout" button (links to `/checkout`)

**Components:**
- `src/features/cart/components/cart-item.tsx` — single line item row
- `src/features/cart/components/cart-summary.tsx` — totals + checkout button
- `src/features/cart/components/empty-cart.tsx` — empty state

### 5e. Cart Dropdown (Desktop Nav)

**Component:** `src/components/nav/cart-dropdown.tsx`

Uses `@proteus/ui` `Popover`:
- **Trigger:** Cart icon + item count badge in the nav
- **Content:** Mini cart view
  - Up to 5 most recent items (thumbnail, title, quantity, price)
  - Subtotal line
  - "Go to cart" button (links to `/cart`)
  - Empty state: "Your cart is empty" + "Browse products" link
- Hidden on mobile (`hidden sm:block` on the Popover content)
- Opens on hover (desktop), closes on mouse leave

**Auto-open behavior (from Medusa):**
- When item count changes (and not on `/cart` page), auto-open for 5 seconds
- Track previous count via `useRef`

---

## 6. Checkout Layout Skeleton

**Route:** `src/routes/_checkout/route.tsx`

### Minimal header
3-column like nav but stripped down:
- **Left:** "Back to cart" link with left arrow icon
- **Center:** "Proteus" logo text
- **Right:** empty spacer

### Body
`<Outlet />` renders child routes.

**Route:** `src/routes/_checkout/index.tsx`
- Placeholder content: "Checkout — Coming soon"

---

## 7. Style Overrides

All style changes happen in `apps/store/src/styles.css` or via Tailwind classes in components. No changes to `packages/ui/`.

### What changes:
- Remove `demo-*` CSS classes that are no longer needed (clean up prototyping styles)
- Keep all CSS custom properties (sea-ink, lagoon, etc.) and dark mode support
- Keep `page-wrap`, `nav-link`, `island-shell`, `rise-in` utilities
- Add any new utility classes needed for the storefront layout (e.g., `.content-container` equivalent)

### What stays:
- Manrope font
- Proteus color palette (sea-ink, lagoon, palm, sand, foam)
- Dark mode support
- Glass-morphism surface effects
- `@proteus/ui` component styling (override via className props, not package changes)

---

## 8. File Inventory

### New files
```
src/lib/cart-id.ts                          — cart ID persistence
src/features/cart/api/cart.ts               — cart React Query hooks
src/features/cart/components/add-to-cart.tsx — add-to-cart button + variant/qty selector
src/features/cart/components/cart-item.tsx   — cart line item row
src/features/cart/components/cart-summary.tsx — cart totals sidebar
src/features/cart/components/empty-cart.tsx  — empty cart state
src/components/nav/nav.tsx                  — new Nav component
src/components/nav/side-menu.tsx            — Sheet-based side menu
src/components/nav/cart-dropdown.tsx        — Popover cart preview
src/routes/_main/route.tsx                  — main layout (Nav + Footer)
src/routes/_main/index.tsx                  — home (moved)
src/routes/_main/login.tsx                  — login (moved)
src/routes/_main/forgot-password.tsx        — (moved)
src/routes/_main/reset-password.tsx         — (moved)
src/routes/_main/verify.tsx                 — (moved)
src/routes/_main/cart.tsx                   — cart page
src/routes/_main/products/route.tsx         — (moved)
src/routes/_main/products/index.tsx         — (moved)
src/routes/_main/products/$productId.tsx    — (moved + add-to-cart)
src/routes/_main/_authed/route.tsx          — (moved)
src/routes/_main/_authed/account.tsx        — (moved)
src/routes/_checkout/route.tsx              — checkout layout skeleton
src/routes/_checkout/index.tsx              — checkout placeholder
```

### Modified files
```
src/routes/__root.tsx                       — remove Header/Footer from RootDocument
src/components/Footer.tsx                   — rewrite with placeholder links
src/styles.css                              — clean up demo classes, add storefront utilities
```

### Deleted files
```
src/components/Header.tsx                   — replaced by nav/nav.tsx
src/routes/index.tsx                        — moved to _main/index.tsx
src/routes/login.tsx                        — moved to _main/login.tsx
src/routes/forgot-password.tsx              — moved
src/routes/reset-password.tsx               — moved
src/routes/verify.tsx                       — moved
src/routes/products/route.tsx               — moved
src/routes/products/index.tsx               — moved
src/routes/products/$productId.tsx          — moved
src/routes/_authed/route.tsx                — moved
src/routes/_authed/account.tsx              — moved
```

### Backend changes
```
apps/backend/src/modules/cart/              — add totals computation
packages/http-schemas/src/store/cart.ts     — add StoreCartTotals schema
```

---

## 9. Implementation Order

1. **Backend: cart totals** — add totals to cart detail response, update http-schemas, regenerate Orval
2. **Route tree restructure** — create layout routes, move all existing routes under `_main/`, strip Header/Footer from `__root.tsx`
3. **Nav component** — build 3-column nav with hamburger + logo + cart placeholder
4. **Side menu** — Sheet-based menu with nav links + ThemeToggle
5. **Footer** — rewrite with placeholder link columns
6. **Cart persistence + API hooks** — `cart-id.ts` + `features/cart/api/cart.ts`
7. **Add to cart** — button on product detail page
8. **Cart page** — items list + summary sidebar
9. **Cart dropdown** — Popover in nav with auto-open behavior
10. **Checkout skeleton** — `_checkout/` layout route with minimal header + placeholder page

---

## 10. Reference Files

**Medusa storefront (layout patterns to port):**
- Nav: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/layout/templates/nav/index.tsx`
- Footer: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/layout/templates/footer/index.tsx`
- SideMenu: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/layout/components/side-menu/index.tsx`
- CartDropdown: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/layout/components/cart-dropdown/index.tsx`
- CartButton: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/layout/components/cart-button/index.tsx`
- Cart template: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/cart/templates/index.tsx`
- Cart items: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/cart/templates/items.tsx`
- Cart item: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/modules/cart/components/item/index.tsx`
- Checkout layout: `/Users/willo/learn/medusa/medusa-store/apps/storefront/src/app/[countryCode]/(checkout)/layout.tsx`

**Proteus store (current code to modify):**
- Root: `apps/store/src/routes/__root.tsx`
- Header: `apps/store/src/components/Header.tsx`
- Footer: `apps/store/src/components/Footer.tsx`
- Product detail: `apps/store/src/routes/products/$productId.tsx`
- Auth guard: `apps/store/src/routes/_authed/route.tsx`
- Cart API (generated): `apps/store/src/api/generated/carts/carts.ts`

**Proteus UI (available components):**
- Sheet: `packages/ui/src/components/ui/sheet.tsx`
- Popover: `packages/ui/src/components/ui/popover.tsx`
- Button: `packages/ui/src/components/ui/button.tsx`
- Badge: `packages/ui/src/components/ui/badge.tsx`
- Card: `packages/ui/src/components/ui/card.tsx`
- Separator: `packages/ui/src/components/ui/separator.tsx`
- Skeleton: `packages/ui/src/components/ui/skeleton.tsx`

**Admin app (organizational reference):**
- Feature structure: `apps/admin/src/features/`
- Route structure: `apps/admin/src/routes/`
- Layout shell: `apps/admin/src/components/layout/shell.tsx`
