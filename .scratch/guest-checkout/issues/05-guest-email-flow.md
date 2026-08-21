# 05 — Guest email flow: findOrCreateCustomer + update cart + email validation

**What to build:** When a guest provides their email during checkout, the system finds or creates a guest customer record and links it to the cart. The `updateCartWorkflow` gains a new step that calls a `findOrCreateCustomer` utility before the address upsert. The `completeCartWorkflow` gains an email validation step that rejects carts without an email. The `UpdateCart` schema is extended with optional `firstName` and `lastName` fields that flow to the guest customer record.

**Blocked by:** 01 — Customer model: `hasAccount` + nullable names; 03 — Guest cart access

**Status:** ready-for-agent

- [ ] `findOrCreateCustomer` utility function created — accepts `{ customerId?, email?, firstName?, lastName? }`, returns `{ customer, created }`. Searches for guest customer (`hasAccount: false`) by email; creates one if not found; returns existing if found (updates name fields if changed). If a registered customer exists with the same email but no guest record, a new guest record is created (they coexist per partial unique index).
- [ ] `UpdateCart` Zod schema extended with `firstName: z.string().optional()` and `lastName: z.string().optional()`
- [ ] `updateCartWorkflow` has a new `find-or-create-customer` step that runs when email is present — sets `customerId` and `email` on the cart from the result
- [ ] Compensation: if a customer was newly created and the workflow fails, the customer is deleted
- [ ] `completeCartWorkflow` has a new validation step that rejects carts without an email (terminal error before order creation)
- [ ] Orval clients regenerated (`npm run openapi:generate`) to pick up schema changes
- [ ] Workflow test: email provided, no existing guest — creates guest customer, sets `customerId` and `email` on cart
- [ ] Workflow test: email provided, existing guest found — reuses customer, sets `customerId` on cart
- [ ] Workflow test: email provided with `firstName`/`lastName` — passes name fields to customer creation
- [ ] Workflow test: no email provided — skips `findOrCreateCustomer`, only updates addresses
- [ ] Workflow test: workflow failure after customer creation — compensates by deleting the newly created customer
- [ ] Workflow test: complete cart without email — throws terminal error
