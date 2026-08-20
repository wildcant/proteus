# 04 — Cart transfer on login

**What to build:** When a guest with an in-progress cart logs in, their cart transfers to the registered customer account. A `transferCartCustomerWorkflow` updates the cart's `customerId` and `email` to the registered customer's values. The store app calls this after login and clears the cart on logout.

**Blocked by:** 01 — Customer model: `hasAccount` + nullable names; 03 — Guest cart access (needed for end-to-end verification — guests must be able to create carts without auth before they can transfer them on login)

**Status:** ready-for-agent

- [ ] `transferCartCustomerWorkflow` created, ported from Medusa's business logic: fetch cart, fetch target customer, guard against same-customer no-op, update cart `customerId` and `email`
- [ ] `POST /store/carts/:id/customer` route created with `auth: 'required'` — resolves `customerId` from `req.authContext.actorId`, runs the transfer workflow
- [ ] Route definition added to cart definitions
- [ ] Store app: login page's `onSuccess` callback calls the cart transfer endpoint if a cart ID exists in localStorage, then invalidates cart queries. Transfer failure must not block login — catch errors gracefully (e.g., log and continue)
- [ ] Store app: `useLogout` hook updated to call `clearCartId()` in addition to clearing the auth token
- [ ] Workflow test: cart belongs to guest, transfer to registered customer — updates `customerId` and `email`
- [ ] Workflow test: cart already belongs to target customer — no-op (no update call)
- [ ] Workflow test: target customer not found — throws error
- [ ] The registered customer's previously active cart (if any) is orphaned — documented as intended behavior (storefront tracks one cart ID in localStorage)
- [ ] TODOs left for follow-up: distributed locking, event emission, `refreshCartItems` for customer-group re-pricing
