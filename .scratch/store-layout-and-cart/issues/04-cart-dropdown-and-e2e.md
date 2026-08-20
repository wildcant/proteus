# 04 — Cart dropdown + E2E tests

**What to build:** A desktop cart dropdown in the nav that previews cart contents on hover, a live item count badge on the cart icon, and a comprehensive E2E test covering the full shopping journey from add-to-cart through checkout layout transition.

**Cart dropdown:** Popover (from `@proteus/ui`) anchored to the cart icon in the nav.
- Shows up to 5 most recent items (thumbnail, title, quantity, price)
- Subtotal line at the bottom
- "Go to cart" button linking to `/cart`
- Empty state: "Your cart is empty" + "Browse products" link
- Hidden on mobile (`hidden sm:block`) — on mobile the cart icon links directly to `/cart`
- Opens on mouse enter, closes on mouse leave (desktop)
- Auto-open behavior: when item count changes (tracked via `useRef` comparing previous count) and the user is not on `/cart`, the dropdown auto-opens for 5 seconds then closes. Timer is cleaned up on unmount.

**Popover API note:** The `@base-ui/react` Popover supports both `openOnHover` on the trigger (for hover behavior) and controlled `open`/`onOpenChange` on the root (for the auto-open timer). Combine both: use controlled state on `Popover` root, wire `onOpenChange` to handle hover events, and set `open` programmatically from the timer effect. Be careful that hover close and timer close don't conflict — the timer should only auto-close if the user hasn't hovered into the popover.

**Cart count badge:** The cart icon in the nav shows a count badge with the total number of items. This updates reactively when items are added, removed, or quantities change.

**E2E test:** A single long Playwright test covering the full cart journey. Uses the existing `createTest` fixture with `factories.create.product`, `factories.create.productVariant`, and `authenticate({ as: 'customer' })`.

**Test factory gap:** The existing `factories.create.product` and `factories.create.productVariant` do NOT create price sets or variant-price-set links. Without prices, the store product detail API filters out variants entirely (the enrichment step in the API route uses `flatMap` which drops variants without calculated prices). The E2E test must either extend the existing factories to also create price data, or add a helper that seeds a product with variants and prices end-to-end. This is a prerequisite for the test to work — without it, the product detail page will show no variants and no "Add to cart" button.

**Toast assertion:** Use `page.locator('[data-slot="toast-title"]')` to find toast notifications in Playwright.

Test flow:
1. Seed two products. Authenticate as a customer.
2. Navigate to first product detail page. Assert add-to-cart button is visible. Click "Add to cart." Assert toast appears. Assert nav cart icon shows item count.
3. Navigate to `/cart`. Assert the item appears with correct title, quantity, and price. Assert totals are displayed (items total, cart total).
4. Change quantity on the cart page. Assert totals update.
5. Navigate to second product, add it to cart. Return to `/cart`. Assert both items appear.
6. Remove one item. Assert it disappears, totals update, remaining item stays.
7. Click "Go to checkout." Assert checkout layout renders (minimal header with "Back to cart" link, no nav hamburger, no footer).
8. Click "Back to cart." Assert full nav and footer are visible again.

Additionally, verify layout basics within the same test or a second test in the same file:
- Nav is visible with hamburger, logo, and cart icon
- Hamburger opens side menu Sheet with Home, Products, Account, Cart links
- Footer shows placeholder link sections and copyright

**Blocked by:** 03 — Cart feature

**Status:** ready-for-agent

- [ ] Desktop: hovering the cart icon in the nav opens a Popover showing up to 5 recent cart items
- [ ] Cart dropdown shows subtotal and "Go to cart" button
- [ ] Cart dropdown is hidden on mobile — cart icon links directly to `/cart` instead
- [ ] Cart dropdown auto-opens for 5 seconds when item count changes (not on `/cart` page)
- [ ] Auto-open timer is cleaned up on component unmount (no memory leak)
- [ ] Nav cart icon shows a count badge reflecting total items in cart
- [ ] Count badge updates reactively when items are added, removed, or quantities change
- [ ] E2E test covers: add to cart, view cart page, update quantity, add second product, remove item, navigate to checkout, return to cart
- [ ] E2E test asserts layout: nav structure (hamburger, logo, cart icon), side menu contents, footer links, checkout minimal header
- [ ] Test factories extended to seed products with variants AND prices (price sets + variant-price-set links)
- [ ] E2E test passes in CI
