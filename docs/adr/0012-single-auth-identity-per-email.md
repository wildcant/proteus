# 12. Single Auth Identity per Email with Multi-Role Support

**Status:** Accepted

## Context

The auth module uses a three-table model: `auth_identity` (the account), `provider_identity` (credentials per provider, e.g. emailpass), and `appMetadata` on `auth_identity` (role references like `userId`, `customerId`).

The `emailpass` provider looks up identities by `entity_id` (email) in `provider_identity`. This means **one email can only have one `provider_identity` per provider**, and therefore one `auth_identity`. The identity is shared across roles.

This surfaced as a bug in the invite-accept workflow: when a customer (`customerId` in `appMetadata`) was invited as an admin user, the workflow failed because:

1. `register()` found the existing identity, saw non-empty `appMetadata`, and rejected it as "not claimable"
2. The fallback `authenticate()` failed because the invite password didn't match the customer's stored password

## Decision

### One identity, multiple roles

A single `auth_identity` can represent both a customer and an admin user. Role references are stored as separate keys in `appMetadata`:

```jsonc
{
  "customerId": "cus_...",  // set during customer registration
  "userId": "usr_..."       // set when an admin invite is accepted
}
```

### Workflows must handle existing identities

The `acceptInviteWorkflow` (and any future workflow that creates or claims an auth identity) must not assume the identity is fresh. When an identity already exists for the email:

- Do **not** try to re-register or re-authenticate with a new password
- Look up the existing identity directly and add the new role reference (`userId`) to `appMetadata`
- The user keeps their existing password — they are already authenticated via their customer account

### The "claimable" concept is limited to pre-created identities

The emailpass provider's claimable check (`appMetadata` is null or empty) is only meant for identities that were pre-created without a password (e.g. by the invite flow itself before the user accepts). It is **not** the mechanism for adding roles to an existing registered identity — that requires a different code path in the workflow.

## Consequences

- The `acceptInviteWorkflow` needs a new branch: if `register()` fails with "already exists", look up the identity by email and attach `userId` to its `appMetadata` instead of falling back to `authenticate()`
- A person who is both a customer and an admin user has one password, one set of credentials
- Token generation must account for multi-role identities — the JWT may need to include both `userId` and `customerId`, or the frontend must resolve the active role from `appMetadata`
- Revoking one role (e.g. removing admin access) means removing `userId` from `appMetadata`, not deleting the identity
