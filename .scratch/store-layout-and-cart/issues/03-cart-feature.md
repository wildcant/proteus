# 03 — Cart feature: persistence + hooks + add to cart + cart page

**What to build:** A shopper can add a product to their cart from the product detail page, then visit a dedicated cart page to review items, change quantities, remove items, and see computed totals. The cart persists across page reloads via localStorage.

**Cart ID persistence:** localStorage-based, same pattern as the existing `auth-token.ts`. Key: `proteus_store_cart_id`. Functions: `getCartId()`, `setCartId(id)`, `clearCartId()`.

**Cart React Query hooks:** Follow the pattern from the existing products feature (`features/products/api/products.ts`):
- Query for fetching cart by ID (reads cart ID from localStorage, returns cart data or null if no cart)
- Mutation for creating a cart (stores returned ID via `setCartId()`)
- Mutation for adding a line item (creates cart first if none exists, then adds item, invalidates cart query)
- Mutation for updating a line item quantity (invalidates cart query)
- Mutation for removing a line item (invalidates cart query)

**Add to cart (product detail page):** New component rendered on the product detail page. Contains:
- Variant selector (if the product has variants with different options)
- Quantity input (1–10)
- "Add to cart" button
- If no cart exists, creates one first then adds the item
- Shows toast notification on success (use `toast.add({ type: 'success', title: '...' })`)
- Button shows loading state during mutation

**Cart creation is simple.** After ticket 01, `currencyCode` is no longer in `CreateStoreCartBody` — it's set server-side by middleware. The frontend just calls `createStoreCart({})` (empty body or with optional `email`).

**Line item payload is denormalized.** The `AddStoreCartLineItemBody` requires `title`, `unitPrice`, `quantity` as mandatory fields — it's not just a variant ID reference. The add-to-cart component must assemble the full payload from product/variant data: `{ title: product.title, unitPrice: variant.calculatedPrice.originalAmount, quantity, variantId: variant.id, productId: product.id, productTitle: product.title, variantTitle: variant.title, thumbnail: product.thumbnail }`.

**Line total is computed client-side.** The backend returns `unitPrice` (string) and `quantity` (number) per line item but no `lineTotal`. Compute it in the cart item component. Use `formatPrice` from `@proteus/ui` (already used on the product detail page) for consistent currency formatting — it takes `(amount: string, currencyCode: string)` where `currencyCode` comes from `cart.currencyCode`.

**Cart page:** Route under the main layout at `/cart`. Two-column layout on desktop (items left, summary sidebar right), single column on mobile.

Left column — cart items list:
- Each item shows: product thumbnail (placeholder if none), product title, variant title, unit price, quantity selector (1–10, triggers update mutation), line total, and remove button (triggers remove mutation)
- Items sorted by creation date (newest first)
- Loading state while mutations are in-flight

Right column — summary sidebar:
- Items total (from `cart.totals.itemsTotal`)
- Shipping total (from `cart.totals.shippingTotal`, or "Calculated at checkout" if zero)
- Cart total (from `cart.totals.cartTotal`)
- "Go to checkout" button linking to `/checkout`

Empty state: "Your cart is empty" message with a link to `/products`.

**Blocked by:** 01 — Backend cart totals, 02 — Storefront shell

**Status:** ready-for-agent

- [ ] Cart ID stored in localStorage and survives page reloads
- [ ] Adding a product to cart from the product detail page creates a cart if none exists, then adds the item
- [ ] Toast notification appears on successful add-to-cart
- [ ] `/cart` page shows all cart items with title, variant info, thumbnail, unit price, quantity, and line total
- [ ] Changing quantity on the cart page updates the line item and refreshes totals
- [ ] Removing an item from the cart page deletes it and refreshes totals
- [ ] Cart summary sidebar shows items total, shipping total, and cart total from the backend response
- [ ] Empty cart state shows a message and link to browse products
- [ ] "Go to checkout" button links to `/checkout`
- [ ] Cart item count is accessible to the nav (for ticket 04 to wire up the badge)
