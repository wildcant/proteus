# 02 — Guest order confirmation (interim)

**What to build:** The order detail endpoint (`GET /store/orders/:id`) becomes accessible without authentication so that guests can view their order confirmation after checkout. For unauthenticated requests, the order ID (a UUID) serves as the access key. For authenticated requests, ownership is still verified (`order.customerId === actorId`). The order list endpoint (`GET /store/orders`) stays auth-required — only registered customers can list their order history. A TODO is left for a proper order access token pattern.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `GET /store/orders/:id` route definition changed to `auth: 'optional'`
- [ ] Route handler: if authenticated, verify `order.customerId === actorId` (existing behavior); if unauthenticated, return the order without ownership check
- [ ] `GET /store/orders` (list) remains `auth: 'required'` — no change
- [ ] TODO comment added to the order detail handler for a future order access token pattern (signed JWT scoped to order ID)
- [ ] Unauthenticated request to `GET /store/orders/:id` with a valid order ID returns the order
- [ ] Authenticated request to `GET /store/orders/:id` with mismatched `customerId` returns not found
- [ ] Unauthenticated request to `GET /store/orders` returns unauthorized
