# Store Layout Refactor & Cart Feature

## Problem Statement

The store app has a flat route structure with Header and Footer hardcoded in the root document shell, making it impossible to have different layouts for different sections (e.g., a minimal checkout layout vs the full storefront). There is no cart feature — the generated API clients exist but no UI, hooks, or cart persistence. The nav is a simple link bar that doesn't follow storefront conventions (hamburger menu, centered logo, cart icon with count). The footer is a static copyright line with no content.

## Solution

Restructure the store's route tree with layout routes (`_main` for full storefront, `_checkout` for minimal checkout), build a proper storefront nav (3-column: hamburger | logo | cart), add a cart feature (add-to-cart, cart page, cart dropdown), and leave checkout as a layout skeleton. Add computed totals to the backend cart detail response so the cart page can display accurate pricing.

## User Stories

1. As a shopper, I want to add a product to my cart from the product detail page, so that I can purchase it later.
2. As a shopper, I want to see a cart icon with item count in the navigation bar, so that I always know how many items are in my cart.
3. As a shopper, I want to hover over the cart icon on desktop and see a dropdown preview of my cart items and subtotal, so that I can quickly review what I've added without leaving the page.
4. As a shopper, I want the cart dropdown to auto-open briefly when I add an item, so that I get visual confirmation the item was added.
5. As a shopper, I want to visit a full cart page that shows all my items with thumbnails, titles, variant info, quantities, and prices, so that I can review my cart before checkout.
6. As a shopper, I want to change the quantity of an item on the cart page, so that I can buy more or fewer of a product.
7. As a shopper, I want to remove an item from my cart, so that I can take out products I no longer want.
8. As a shopper, I want to see a cart summary with items total, shipping total (or "calculated at checkout"), and cart total, so that I understand what I'll pay.
9. As a shopper, I want to see an empty cart state with a link to browse products, so that I know what to do when my cart is empty.
10. As a shopper, I want a "Go to checkout" button on the cart page that takes me to the checkout layout, so that I can proceed to purchase.
11. As a shopper on mobile, I want to tap a hamburger menu to open a side panel with navigation links, so that I can navigate the store.
12. As a shopper on mobile, I want the side menu to include Home, Products, Account, Cart links and a theme toggle, so that I have full access to the store.
13. As a shopper on mobile, I want to tap the cart icon in the nav to go directly to the cart page (no dropdown), so that I get a mobile-friendly cart experience.
14. As a shopper, I want the navigation bar to be sticky at the top of the page, so that I can always access navigation and cart.
15. As a shopper, I want to see a footer with placeholder link sections (Shop, Help, Company) and a copyright line, so that the store feels complete.
16. As a shopper on the checkout page, I want to see only a minimal header with a "Back to cart" link and the store logo, so that I'm not distracted during checkout.
17. As a shopper, I want my cart to persist across page reloads and browser sessions, so that I don't lose my items.
18. As a shopper, I want to see a toast notification when I add an item to my cart, so that I know the action succeeded.
19. As a shopper viewing a product with variants, I want to select a variant before adding to cart, so that I get the right product option.
20. As a shopper, I want the cart dropdown on desktop to show up to 5 recent items with a "Go to cart" link for the full view, so that the dropdown stays compact.

## Implementation Decisions

### Route tree restructure

Move Header and Footer out of the root document shell (`__root.tsx`). Create two layout routes:

- `_main/route.tsx` — renders Nav + Outlet + Footer. All current pages (home, login, forgot-password, reset-password, verify, products, cart, account) move under this layout.
- `_checkout/route.tsx` — renders a minimal header (back-to-cart link, "Proteus" logo, empty spacer) + Outlet. Contains a placeholder checkout page.
- `_authed` nests inside `_main` as `_main/_authed/`. URL paths are unchanged because underscore-prefixed layout routes don't appear in URLs.

Auth pages (login, forgot-password, reset-password, verify) live under `_main` and get the full Nav + Footer.

### Nav component

Three-column sticky header (`sticky top-0 z-50`):
- Left: hamburger button that opens a `Sheet` (from `@proteus/ui`, `side="left"`)
- Center: "Proteus" text logo linking to `/`
- Right: cart icon with item count badge. On desktop (>= 640px), triggers a `Popover` (from `@proteus/ui`) showing cart preview. On mobile, links directly to `/cart`.

The Sheet side menu contains: navigation links (Home, Products, Account, Cart), ThemeToggle (moved from the old header), and a copyright line at the bottom.

Component files live at `src/components/nav/` (nav.tsx, side-menu.tsx, cart-dropdown.tsx).

### Footer component

Rewrite the existing footer as a 3-column responsive grid of placeholder links (Shop: Home/Products/Cart, Help: FAQ/Contact, Company: About) with a copyright row below. Uses `page-wrap` container class and Proteus design tokens.

### Backend cart totals

The `GET /store/carts/:id` response currently returns `{ cart: { ...cart, items, shippingMethods } }`. Add a `totals` object computed in the API route handler:

```ts
type CartTotals = {
  itemsTotal: string   // sum of (unitPrice * quantity) per line item
  shippingTotal: string // sum of shipping method amounts
  cartTotal: string     // itemsTotal + shippingTotal
}
```

Computation happens in the API route (`apps/backend/src/api/store/carts/[id]/route.ts`), not in the cart module service — totals are a presentation concern, not a domain concern.

Add a `StoreCartTotals` Zod schema in `packages/http-schemas/src/store/cart/entities.ts` and extend `StoreCartDetailResponse` to include it. Regenerate Orval clients after.

Prices use `bignum` (arbitrary-precision numeric strings). Totals computation must use string-based arithmetic or convert to numbers carefully — follow the existing `bigNumberToString` pattern.

### Cart ID persistence

`src/lib/cart-id.ts` — localStorage-based, same pattern as `auth-token.ts`. Key: `proteus_store_cart_id`. Functions: `getCartId()`, `setCartId(id)`, `clearCartId()`.

### Cart feature (React Query hooks)

`src/features/cart/api/cart.ts` — following the pattern from `features/products/api/products.ts`:

- `cartQueryOptions(cartId)` — query options for `getStoreCart(cartId)`
- `useCart()` — reads cart ID from localStorage, returns cart data or null
- `useCreateCart()` — mutation wrapping `createStoreCart()`, calls `setCartId()` on success
- `useAddToCart()` — mutation wrapping `addStoreCartLineItem()`, creates cart first if none exists, invalidates cart query
- `useUpdateLineItem()` — mutation wrapping `updateStoreCartLineItem()`, invalidates cart query
- `useRemoveLineItem()` — mutation wrapping `deleteStoreCartLineItem()`, invalidates cart query

### Add to cart (product detail page)

New component `src/features/cart/components/add-to-cart.tsx` rendered on the product detail page. Contains variant selector (if applicable), quantity input (1-10), and "Add to cart" button. If no cart exists, creates one first, then adds the item. Shows toast on success.

### Cart page

Route at `src/routes/_main/cart.tsx`. Two-column layout on desktop (items + summary sidebar), single column on mobile. Left: list of cart items sorted newest-first, each with thumbnail, title, variant info, quantity selector, unit price, line total, and remove button. Right: totals from the backend response + "Go to checkout" button. Empty state shows a message and link to `/products`.

Cart page components: `src/features/cart/components/cart-item.tsx`, `cart-summary.tsx`, `empty-cart.tsx`.

### Cart dropdown

`src/components/nav/cart-dropdown.tsx` — `Popover` anchored to the cart icon in the nav. Shows up to 5 recent items with thumbnail, title, quantity, price, plus a subtotal line and "Go to cart" button. Hidden on mobile (`hidden sm:block`). Auto-opens for 5 seconds when item count changes (tracked via `useRef`), unless the user is already on `/cart`.

### Styling approach

Keep Proteus design tokens (sea-ink, lagoon, palm, sand, foam), dark mode, glassmorphism surfaces, Manrope font. Override `@proteus/ui` component styles via `className` props in the store app — no changes to the `packages/ui` package. Clean up leftover `demo-*` CSS classes from `styles.css` if they're unused.

## Testing Decisions

### What makes a good test

Tests exercise external behavior through the UI — what a shopper sees and does. No testing of React Query hooks, component internals, or implementation details. Tests use real browser interactions (Playwright) against a real backend with seeded data.

### Single seam: Playwright E2E

All testing goes through the existing Playwright E2E seam at `apps/store/tests/e2e/`. This is the highest seam available and covers both the backend totals change and all store UI in one pass.

### Test structure: fewer, longer tests

Group related assertions into one test per user journey. Don't split steps that share the same setup (authenticate, seed product, navigate) into separate `test()` blocks — the duplicated arrange phase is expensive and the isolation is false. Multiple act-assert cycles within one test are encouraged.

### Prior art

`apps/store/tests/e2e/auth.spec.ts` and `apps/store/tests/e2e/products.spec.ts` demonstrate the pattern: `createTest` fixture with `factories.create.product`, `factories.create.customer`, `authenticate`, and `navigate` helpers.

### Test file

`apps/store/tests/e2e/cart.spec.ts` — a single long test covering the full cart journey:

1. Seed a product (with variants if the factory supports it). Authenticate as a customer. Navigate to the product detail page.
2. Assert the add-to-cart button is visible. Select a variant if applicable, set quantity, click "Add to cart." Assert toast appears. Assert cart icon in nav updates to show count.
3. Navigate to `/cart`. Assert the item appears with correct title, quantity, and price. Assert totals are displayed.
4. Change quantity on the cart page. Assert the line total and cart total update.
5. Add a second product to cart (navigate to another product, add it). Return to `/cart`. Assert both items appear.
6. Remove one item. Assert it disappears, totals update, remaining item stays.
7. Assert "Go to checkout" button links to `/checkout`. Click it. Assert the checkout layout renders (minimal header with "Back to cart" link, no nav/footer).
8. Click "Back to cart" to return. Assert full nav and footer are visible again.

### Layout test

`apps/store/tests/e2e/layout.spec.ts` — a single test covering the navigation and layout structure:

1. Navigate to home. Assert sticky nav is visible with hamburger, "Proteus" logo, and cart icon.
2. Open the side menu (click hamburger). Assert Sheet opens with Home, Products, Account, Cart links. Close it.
3. Assert footer is visible with placeholder link sections and copyright.
4. Navigate to `/checkout`. Assert minimal header (back-to-cart link, logo). Assert no nav hamburger, no footer.

## Out of Scope

- Checkout flow (payment, shipping, address forms) — only the layout skeleton
- Product categories and collections
- Multi-language / countryCode routing
- CartMismatchBanner (warning when cart isn't linked to customer)
- FreeShippingNudge
- Suspense boundaries for cart loading
- Changes to `@proteus/ui` package
- Guest vs logged-in cart merging
- Promo codes / discounts
- Tax computation
- Order placement (cart completion)

## Further Notes

- The `bignum` column type stores prices as arbitrary-precision numeric strings. Cart totals computation in the API route must handle these correctly — either use a BigNumber library or convert carefully. Follow whatever pattern the order totals computation already uses.
- The cart has no `subtotal` field distinct from `itemsTotal`. If discounts are added later, `itemsTotal` would need to account for them. For now, `itemsTotal = sum(unitPrice * quantity)` is sufficient.
- The `StoreCartLineItem` has `compareAtUnitPrice` for strike-through pricing. The cart item component should show this if present (original price crossed out, current price highlighted). This is a nice-to-have within scope if the component is being built anyway.
- Cart dropdown auto-open uses a 5-second timer pattern from the Medusa reference. The timer should be cleaned up on unmount to avoid memory leaks.
- The `_checkout` layout route renders only a placeholder page. When checkout is implemented later, it will be a separate spec that adds child routes under `_checkout/`.
