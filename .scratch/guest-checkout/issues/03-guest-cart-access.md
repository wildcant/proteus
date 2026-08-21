# 03 — Guest cart access: auth policies + ownership middleware

**What to build:** All cart and payment endpoints become accessible to unauthenticated visitors. A `validateCartOwnership` middleware protects registered customers' carts while allowing guest carts through. After this ticket, an unauthenticated API request can create a cart, add items, retrieve it, update addresses, select shipping, and complete checkout — but cannot touch a cart that belongs to a registered customer.

**Blocked by:** 01 — Customer model: `hasAccount` + nullable names

**Status:** ready-for-agent

- [ ] All cart route definitions (`POST /store/carts`, `GET /store/carts/:id`, `POST /store/carts/:id`, line items, shipping options, shipping methods, complete, inventory) set `auth: 'optional'`
- [ ] Payment collection, payment session, and payment provider route definitions set `auth: 'optional'`
- [ ] `validateCartOwnership` middleware created and applied to all cart routes with an `:id` parameter (NOT applied to `POST /store/carts` which has no `:id`)
- [ ] Middleware ownership rules: registered customer's cart (`hasAccount: true`) requires matching `actorId`; guest customer's cart (`hasAccount: false`) allows any request; cart with no customer allows any request
- [ ] Middleware fast path: if `cart.customerId` matches `req.authContext.actorId`, allow immediately without customer lookup
- [ ] Test: cart with registered customer + matching `actorId` — allowed
- [ ] Test: cart with registered customer + no auth — forbidden
- [ ] Test: cart with registered customer + wrong `actorId` — forbidden
- [ ] Test: cart with guest customer + no auth — allowed
- [ ] Test: cart with guest customer + authenticated — allowed
- [ ] Test: cart with no customer + no auth — allowed
- [ ] Unauthenticated API request to create a cart succeeds
- [ ] Unauthenticated API request to retrieve a guest cart succeeds
