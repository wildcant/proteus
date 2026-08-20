# 01 — Customer model: `hasAccount` + nullable names

**What to build:** Customer records support a `hasAccount` boolean flag (default `false`) that distinguishes guest customers from registered accounts. `firstName` and `lastName` become nullable so guest records can be created with just an email. The same email can have both a guest and a registered customer record, enforced by partial unique indexes. The registration flow sets `hasAccount: true` when creating a customer with an auth identity. All types, DTOs, filter props, HTTP schemas (admin + store), and test factories are updated to reflect the model change. The existing customer migration is deleted and regenerated. Existing customer module tests are updated and new tests verify the `hasAccount` behavior.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Customer model has `hasAccount` boolean column, default `false`, NOT NULL
- [ ] Customer model `firstName` and `lastName` are nullable
- [ ] Unique constraint on `email` replaced with two partial unique indexes: one for `hasAccount = true` and one for `hasAccount = false` (both filtered on `deletedAt IS NULL`)
- [ ] `CustomerDTO` includes `hasAccount: boolean` and `firstName`/`lastName` as `string | null`
- [ ] `CreateCustomerDTO` includes optional `hasAccount`, optional `firstName`, optional `lastName`
- [ ] `UpdateCustomerDTO` reviewed: `hasAccount` must NOT be updatable via this type (prevent accidental flag changes); `firstName`/`lastName` remain optional strings (updates pass values, not null)
- [ ] `FilterableCustomerProps` includes `hasAccount` for filtering
- [ ] Admin and store HTTP entity schemas include `hasAccount: z.boolean()` and nullable `firstName`/`lastName`
- [ ] Admin create customer schema keeps `firstName`/`lastName` required
- [ ] Registration flow (`createCustomerAccountWorkflow` or equivalent) passes `hasAccount: true` when creating a customer with an auth identity
- [ ] Test factories updated for nullable names and `hasAccount` field
- [ ] Customer migration deleted and regenerated via `drizzle-kit generate`
- [ ] Orval clients regenerated (`npm run openapi:generate`) after entity schema changes
- [ ] Test: create customer with `hasAccount: false` and only an email (no name) succeeds
- [ ] Test: two customers with same email but different `hasAccount` values both persist
- [ ] Test: two customers with same email and same `hasAccount` value fails (partial unique index violation)
- [ ] Test: retrieve customer with null `firstName`/`lastName` returns `null`
- [ ] Test: filter customers by `hasAccount` returns only matching records
- [ ] Test: registration flow creates a customer with `hasAccount: true`
- [ ] All existing customer module tests pass with the updated model
