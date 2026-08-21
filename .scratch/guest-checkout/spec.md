# Guest Checkout

## Problem Statement

The store requires authentication for the entire cart and checkout flow. A visitor who wants to buy something must create an account before they can even add items to a cart. This creates unnecessary friction — most e-commerce customers expect to check out as a guest with just an email address. The current system also lacks the data model to distinguish between guest and registered customers, has no mechanism to transfer a guest cart to a registered account on login, and provides no way for a guest to view their order confirmation after completing checkout.

## Solution

Enable a complete guest checkout flow where unauthenticated visitors can browse, add to cart, enter contact information (email + optional name), provide shipping/billing addresses, select shipping, pay, and complete an order — all without creating an account. The system follows Medusa's data model: a `hasAccount` boolean on the Customer model allows guest and registered customer records to coexist for the same email. When a guest logs in, their cart transfers to the registered account. The checkout UI adds a Contact step (shown only to guests) before the address step.

## User Stories

1. As a store visitor, I want to add products to a cart without logging in, so that I can browse and shop freely.
2. As a store visitor, I want to enter my email and optionally my name during checkout, so that the store can associate my order with my contact information.
3. As a store visitor, I want to provide shipping and billing addresses during checkout without an account, so that I can complete my purchase as a guest.
4. As a store visitor, I want to select a shipping method during guest checkout, so that I can choose how my order is delivered.
5. As a store visitor, I want to pay and complete my order without an account, so that I don't have to register just to make a purchase.
6. As a store visitor, I want to see my order confirmation page after completing checkout, so that I can verify my order details.
7. As a store visitor who decides to register after guest checkout, I want my guest order to remain accessible in the system, so that an admin can transfer it to my registered account if needed.
8. As a store visitor with an in-progress guest cart, I want to log in and have my guest cart become my active cart, so that I don't lose my selected items.
9. As a registered customer, I want my cart to be protected so that only I can view or modify it, so that my cart data is secure.
10. As a registered customer, I want to check out without re-entering my email, so that the checkout flow is streamlined.
11. As a store admin, I want to see whether a customer record is a guest or a registered account, so that I can understand my customer base.
12. As a store admin, I want guest checkout orders to have an email on them, so that I can communicate with the customer about their order.
13. As a store visitor, I want the checkout to prevent me from completing an order without an email, so that the store can send me order updates.
14. As a registered customer who previously had a cart, I want the system to keep my guest cart (not my old cart) when I log in mid-checkout, so that the items I just selected are preserved.

## Implementation Decisions

### Customer model: `hasAccount` flag

Add a `hasAccount` boolean column to the Customer model, defaulting to `false`. Make `firstName` and `lastName` nullable (guest records may only have an email).

Replace the existing unique constraint on `email` with two partial unique indexes:
- `(email)` WHERE `hasAccount = true AND deletedAt IS NULL` — one registered account per email
- `(email)` WHERE `hasAccount = false AND deletedAt IS NULL` — one guest record per email

This allows two customer records with the same email to coexist: one guest and one registered. They are never merged. This follows Medusa's exact data model and avoids cross-module migration complexity on registration.

Registration sets `hasAccount: true`. The `findOrCreateCustomer` utility creates records with `hasAccount: false`.

Type changes that cascade from this model change:
- `CustomerDTO`: `hasAccount: boolean`, `firstName: string | null`, `lastName: string | null`
- `CreateCustomerDTO`: add optional `hasAccount`, make `firstName`/`lastName` optional
- `FilterableCustomerProps`: add `hasAccount` (required by `findOrCreateCustomer` to filter by `{ email, hasAccount: false }`)
- Test factories (`generateCreateCustomerDTO`, `generateCustomerDTO`, `generateCustomer`): update for nullable names and new field

### Migration strategy

Delete the existing customer migration folder and regenerate using `drizzle-kit generate`, keeping the migration filename. No data backfill needed (no production customers).

### `findOrCreateCustomer` utility

A reusable async function (not a workflow) that encapsulates the find-or-create logic for guest customers. Called from within workflow steps that provide compensation.

Input: `{ customerId?, email?, firstName?, lastName? }`
- Neither `customerId` nor `email` provided: returns `undefined`
- `customerId` provided: fetches by ID, returns existing customer
- `email` provided: searches for a guest customer (`hasAccount: false`) by email. If found, returns it (updates name fields if provided and changed). If not found, creates a new guest customer with `{ email, hasAccount: false, firstName, lastName }`. Note: if only a *registered* customer exists with that email (no guest record), a new guest record is created — the two coexist per the partial unique index design. The search always filters on `hasAccount: false`.

Compensation at the workflow step level: if a customer was newly created and the workflow fails, delete the customer.

### Update cart workflow changes

When the `updateCartWorkflow` receives an `email` in its input, it runs `findOrCreateCustomer` as a new step before the existing address-upsert step. The resulting customer ID and email are set on the cart. This is the primary path for guest email entry — the Contact form submits to the update cart endpoint.

`firstName` and `lastName` are added to the `UpdateCart` schema as optional fields. They flow through the workflow to `findOrCreateCustomer` for the guest customer record.

### Cart route auth policies

All cart route definitions change from the default `auth: 'required'` to `auth: 'optional'`. This allows unauthenticated requests to proceed with `req.authContext` absent. Payment collection, payment session, and payment provider routes also change to `auth: 'optional'`.

### `validateCartOwnership` middleware

A middleware applied to all cart routes with an `:id` parameter. Enforces ownership rules:

| Cart customer | `hasAccount` | Request | Result |
|---|---|---|---|
| Set | `true` (registered) | Authenticated, `actorId` matches | Allow |
| Set | `true` (registered) | Unauthenticated or wrong `actorId` | Forbidden |
| Set | `false` (guest) | Any | Allow (UUID is the key) |
| Not set | N/A | Any | Allow (UUID is the key) |

The fast path: if `cart.customerId` exists and `req.authContext.actorId` matches it, allow immediately without a customer lookup. Only fetch the customer record when the ownership check needs to inspect `hasAccount`.

### Complete cart workflow: email validation

Add a validation step to the `completeCartWorkflow` that rejects carts without an email. This ensures guests entered their email in the Contact step before completing checkout.

### Cart transfer workflow

A new `transferCartCustomerWorkflow` ported from Medusa's business logic. Called via `POST /store/carts/:id/customer` (auth required).

Steps:
1. Fetch cart (including customer relationship for `hasAccount` check)
2. Fetch target customer (the authenticated registered customer)
3. Guard: if cart already belongs to this customer, no-op
4. Update cart: set `customerId` and `email` to the registered customer's values

The registered customer's previously active cart (if any) becomes orphaned. The storefront only tracks one cart ID in localStorage, so the old cart is simply abandoned.

TODOs left for follow-up: distributed locking on the cart ID, event emission, and `refreshCartItems` for customer-group re-pricing.

### Registration flow: setting `hasAccount: true`

The `createCustomerAccountWorkflow` (called by `completeCustomerAuthWorkflow` during signup) passes `hasAccount: true` in the customer creation input. This is the only place the flag is set to `true`. The `CreateCustomerDTO` type must include `hasAccount` as an optional field for this to work.

### Cart creation route

No workflow needed for cart creation. Guests create carts without email or customer — those are set later via the Contact form and the update cart workflow. The existing route logic (authenticated users resolve customer email, guests get an empty cart) stays as-is. The `validateCartOwnership` middleware is NOT applied to `POST /store/carts` since it has no `:id` parameter.

### Order confirmation: interim guest access

Change `GET /store/orders/:id` to `auth: 'optional'`. For unauthenticated requests, allow access by order ID alone (UUIDs are unguessable). For authenticated requests, verify `order.customerId === actorId`.

`GET /store/orders` (list) stays `auth: 'required'` — only registered customers list their order history.

Mark with a TODO for a proper order access token pattern (signed JWT scoped to the order, returned from complete-cart, validated on the order detail route).

### Store app: Contact form

A new checkout step (`CONTACT`) rendered conditionally — only for guests (no auth token in localStorage). The step renders three fields: email (required), firstName (optional), lastName (optional).

The form hook picks fields from the `UpdateCart` Zod schema (using `.pick()` and `.extend()` to make email required), following the project's form hook pattern. The mutation calls `useUpdateCart`.

Guest checkout flow: CONTACT > ADDRESS > DELIVERY > PAYMENT > REVIEW.
Authenticated flow: ADDRESS > DELIVERY > PAYMENT > REVIEW (CONTACT skipped).

The `useCheckoutProgress` hook must be updated: add a `hasContact` completion check (e.g., `!!cart.email`) and compute step numbers dynamically based on whether CONTACT is shown, so ADDRESS is step 1 for authenticated users and step 2 for guests. The default step when navigating to `/checkout` without a step param should be `CONTACT` for guests and `ADDRESS` for authenticated users.

### Store app: cart transfer on login

After a successful login, if a cart ID exists in localStorage, the storefront calls the cart transfer endpoint (`POST /store/carts/:id/customer`) to reassign the guest cart to the registered customer. Cart queries are invalidated after transfer. The cart transfer call is made from the login page component's `onSuccess` callback, not inside the `useLogin` hook itself — this keeps the hook generic.

On signout, `useLogout` must clear the cart ID from localStorage (call `clearCartId()`) in addition to clearing the auth token. The current implementation does not do this.

### HTTP schema changes

- `UpdateCart`: add `firstName: z.string().optional()`, `lastName: z.string().optional()`
- Customer entity schemas (admin + store): add `hasAccount: z.boolean()`, make `firstName`/`lastName` nullable
- Admin create customer schemas: keep `firstName`/`lastName` required (admins create registered customers)
- After all schema changes, run `npm run openapi:generate` to regenerate Orval clients in both admin and store apps

## Testing Decisions

Tests validate external behavior through the service, workflow, and middleware interfaces. They do not test internal implementation details like which repository method was called or how the utility function is structured internally.

### Customer module service tests

Extend the existing `customer-module-service.test.ts` (integration tests against real Postgres).

Test cases:
- Create a customer with `hasAccount: false` and only an email (no name) — succeeds
- Create two customers with the same email but different `hasAccount` values — both persist
- Create two customers with the same email and same `hasAccount` value — fails (partial unique index violation)
- Retrieve a customer with nullable `firstName`/`lastName` — returns `null` for those fields
- Filter customers by `hasAccount` — returns only matching records

Prior art: existing tests in `apps/backend/src/modules/customer/__tests__/customer-module-service.test.ts`.

### Workflow tests

Unit tests with mocked services via Awilix container, following the `complete-cart.test.ts` pattern.

**`updateCartWorkflow` tests:**
- Email provided, no existing guest customer: creates guest customer, sets `customerId` and `email` on cart
- Email provided, existing guest customer found: reuses customer, sets `customerId` on cart
- Email provided with `firstName`/`lastName`: passes name fields to customer creation
- No email provided: skips `findOrCreateCustomer`, only updates addresses
- Workflow failure after customer creation: compensates by deleting the newly created customer

**`transferCartCustomerWorkflow` tests:**
- Cart belongs to guest, transfer to registered customer: updates `customerId` and `email`
- Cart already belongs to target customer: no-op (no update call)
- Target customer not found: throws error

**`completeCartWorkflow` tests (extend existing):**
- Cart without email: throws terminal error before order creation

Prior art: existing tests in `apps/backend/src/workflows/cart/__tests__/complete-cart.test.ts`.

### Middleware tests

Unit tests with mock request objects, following the `authenticate.test.ts` pattern.

**`validateCartOwnership` tests:**
- Cart with registered customer, matching `actorId`: allows
- Cart with registered customer, no auth: returns forbidden
- Cart with registered customer, wrong `actorId`: returns forbidden
- Cart with guest customer, no auth: allows
- Cart with guest customer, authenticated: allows
- Cart with no customer, no auth: allows

Prior art: existing tests in `apps/backend/src/core/auth/__tests__/authenticate.test.ts`.

## Out of Scope

- **Order access tokens.** Proper signed-token-based guest access to order details is deferred. The interim solution treats order UUIDs as unguessable access keys.
- **Order transfer workflows.** Porting Medusa's request/accept/decline/cancel/transfer-to-guest workflows for admin order reassignment is a follow-up task.
- **Guest customer cleanup.** Periodic purging of guest customer records with no associated orders is not included. Guest records persist indefinitely.
- **Customer group re-pricing on cart transfer.** The `transferCartCustomerWorkflow` does not re-price items for customer groups (customer groups don't exist yet).
- **Distributed locking.** No lock guards on concurrent cart operations or cart transfer.
- **Event emission.** No domain events emitted for cart transfer or guest customer creation.
- **`createCartWorkflow`.** Cart creation stays as a direct service call. If a guest provides an email at cart creation time (possible via API, not via storefront UI), it will not trigger `findOrCreateCustomer`. The email flows through the update cart path instead.
- **Saved addresses for guests.** Guests do not get address selection from previous orders.
- **Admin `hasAccount` display and filtering.** The admin customer list will include `hasAccount` in the API response (via entity schema), but adding a table column, filter, or badge in the admin UI is a follow-up. Guest customers with null names will render without names in the admin list until addressed separately.

## Further Notes

- The `hasAccount` flag is set to `true` in exactly one place: the customer account creation flow triggered by registration (when an `authIdentityId` is present). It is never toggled back to `false`.
- Same-email coexistence (guest + registered) is by design. Medusa chose this over merging because: (a) merging requires cross-module link migration at runtime, (b) workflow compensation can't un-merge, (c) a guest order with `john@example.com` may not belong to the person who later registers as John, and (d) an explicit admin transfer workflow handles the cases where merging is wanted.
- The Contact form's `firstName`/`lastName` fields populate the guest customer record, not the cart addresses. Shipping/billing address names are stored in the address table. These are independent — no override logic.
- When a guest changes their email between checkout steps, `findOrCreateCustomer` re-runs and may link the cart to a different guest customer. The previously created guest customer becomes orphaned (no orders). This matches Medusa's behavior.
- On signout, the storefront clears the cart ID from localStorage. The cart is orphaned. This matches Medusa's behavior.
