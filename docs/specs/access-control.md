# Access Control

**Status:** proposed.

This document specifies a reusable authorization module for Proteus. It replaces the CASL-first
exploration in `docs/access-control-module-architecture.md` as the product and architecture target.
That document remains research, not an implementation contract.

The design borrows Ash's separation of actions, actors, resources, policy checks, query filters and
field policies. It deliberately starts with granular role-based access control (RBAC), while keeping
the public contract capable of claims-based, relationship-based and attribute-based authorization
without replacing the module or changing every caller.

---

## Problem Statement

Proteus currently authenticates two broad actor types, `user` and `customer`. An authenticated admin
user effectively has the whole admin API. This is insufficient for businesses that need several
admin roles such as catalogue editor, order operator, support agent and finance manager.

A conventional RBAC implementation can solve that immediate problem, but a role-only API becomes a
dead end as soon as access depends on facts such as:

- the active organization or tenant;
- a verified email address or trusted email domain;
- whether the session is delegated or impersonated;
- ownership of a record;
- membership in a project or team;
- the store to which an order belongs;
- the current status of a record; or
- a customer's segment.

Those facts must not become scattered `if` statements in routes and services. They need one
authorization vocabulary and one enforcement contract. The initial implementation must stay small,
however: Proteus does not yet need multitenancy, a general policy language, PostgreSQL row-level
security or a CASL-compatible rules engine.

## Product Outcome

Administrators can create multiple roles, assign registered permissions to them and assign one or
more roles to an admin user. Backend operations enforce those permissions by default.

Developers can later add claim, relationship, resource, field and scope policies through the same
authorization service. Existing route and service call sites do not change when those policy types
arrive.

## Goals

1. Support multiple admin roles and granular permissions in the first release.
2. Make authorization default-deny and independent of mutable role names.
3. Give every enforcement point the same actor/action/resource/context vocabulary.
4. Support list scoping as database filters, not in-memory filtering.
5. Reserve first-class seams for claims, relationships, resource attributes and field policies.
6. Reserve an explicit scope model so organization or tenant isolation can be added later.
7. Keep policy definitions in application code and role composition in the database.
8. Preserve module isolation and the ORM-neutral core/framework boundary.
9. Package the design so it can be reused in another Proteus-based system.
10. Produce explainable decisions and an auditable trail for privileged changes.

## Non-Goals

- Multitenancy in the first release.
- PostgreSQL row-level security in the first release.
- A user-authored JSON policy language.
- Arbitrary JavaScript expressions stored in the database.
- Per-user permission grants or denies.
- Role inheritance or nested roles.
- Explicit deny permissions in RBAC.
- Replacing authentication, token validation or identity management.
- Authorizing solely at the HTTP layer.
- Choosing CASL, Oso, Cedar or another policy runtime before the Proteus contract is proven.

## Users and Stories

1. As a system administrator, I can create a role from registered permissions so responsibilities
   can be separated without code changes.
2. As a system administrator, I can assign several roles to a user so their effective permissions
   are the union of their job functions.
3. As a catalogue editor, I can manage products without receiving access to payments or user
   administration.
4. As a developer, I declare a stable permission key beside the owning module so renaming a role
   never changes enforcement.
5. As a developer, I use the same authorization request for an HTTP route, workflow, subscriber or
   background job.
6. As a developer, I can constrain reads to records the actor may see without fetching forbidden
   rows into memory.
7. As a developer, I can later add ownership, membership, status or claim checks without replacing
   existing permission checks.
8. As a security operator, I can determine why a request was allowed or denied without exposing
   sensitive policy details to the caller.
9. As a future tenant administrator, I can manage roles inside a scope without changing the meaning
   of existing permission keys.

---

## Authorization Model

### Authentication and authorization remain separate

Authentication establishes who is making the request and how the session was established.
Authorization decides whether that actor may perform an action on a resource in the current scope.

`AuthContext` remains the authentication result. A trusted adapter converts it into an
`AuthorizationActor`. Route handlers must not construct trusted claims from request bodies, query
parameters or unverified token metadata.

### One request vocabulary

Every decision uses the following conceptual input:

```typescript
type AuthorizationRequest<ResourceAttributes = Record<string, unknown>> = {
  actor: AuthorizationActor
  action: string
  resource: {
    type: string
    id?: string
    attributes?: ResourceAttributes
  }
  scope: AuthorizationScope
  context: AuthorizationContext
}

type AuthorizationActor = {
  id: string
  type: string
  claims: Readonly<Record<string, unknown>>
}

type AuthorizationScope =
  | { type: 'system' }
  | { type: string; id: string }

type AuthorizationContext = {
  session: {
    id?: string
    authenticationMethod?: string
    delegatedByActorId?: string
    impersonatedByActorId?: string
  }
  now: Date
}
```

The first release always supplies `{ type: 'system' }`. This is request vocabulary, not a reason to
persist placeholder scope columns. Future organization and tenant support adds scoped assignments
and resource policies without changing this request shape.

### Stable permission keys

A permission is a code-registered capability with an immutable key:

```text
product.read
product.create
product.update
product.delete
order.read
order.fulfill
user.role.manage
```

Keys use `<resource>.<action>`. Module-defined actions such as `order.refund` are valid; the system
does not force every resource into CRUD. Role names are labels and are never used in guards.

Each permission registration includes a key, owning module, display metadata and whether it is
assignable. Startup synchronization mirrors this catalogue into the access-control database so the
admin UI can compose roles. Removing or renaming a shipped key requires an explicit migration.

### Two-stage decision

Authorization has two stages:

1. **Capability grant.** At least one active role assigned to the actor in the active scope grants
   the requested permission. Multiple roles form a union.
2. **Policy constraints.** Every applicable code-defined policy for the action must authorize the
   request. Policies may inspect trusted claims, relationships, resource attributes, fields and
   scope.

Absence of a capability grant denies the request. An applicable policy that cannot obtain the facts
it requires also denies the request. Adding a broad role therefore cannot silently bypass an
ownership, tenant or session-safety policy attached to the resource action.

The first release implements the capability stage and the policy contract. It may ship only simple
policies needed to protect access-control administration. Later policy types plug into stage two.

### Policy structure

A resource-owning module registers policies in code. A policy has:

- a stable id;
- the resource type and actions it covers;
- an optional condition that decides whether the policy applies;
- ordered checks that authorize or forbid; and
- optional field and query-filter behavior.

All applicable policies must pass. Checks inside one policy are evaluated in declaration order so a
narrow exception can precede a general rule. An inconclusive policy is a denial.

This follows the useful parts of Ash's policy model without adopting its solver or DSL in the first
release.

### No per-user ACL overrides

Users receive roles, not direct permissions. A one-off exception is represented by a narrowly named
role, visible in the same administration and audit paths as every other grant. This avoids hidden
privilege, ambiguous aggregation and revocation paths that depend on checking two grant systems.

Temporary access may later add an expiry to a role assignment. It must not add a second permission
override model.

### No role hierarchy

Roles do not inherit from other roles. Multiple role assignment provides composition without
recursive resolution, cycle handling or surprising transitive grants.

### No explicit RBAC deny

The RBAC layer contains grants only. Absence means deny. Mandatory restrictions belong in policies,
where their precedence is explicit and testable. This prevents role-union semantics from becoming
order-dependent.

---

## Public Contract

The reusable vocabulary and port live under `apps/backend/src/core/access-control/` and
`apps/backend/src/core/types/access-control/`. They contain no Awilix, Drizzle or HTTP types.

The public service exposed by the module is conceptually:

```typescript
type AuthorizationDecision = {
  allowed: boolean
  reason: AuthorizationReason
  matchedRoleIds: readonly string[]
  matchedPolicyIds: readonly string[]
}

type AuthorizationReason =
  | 'allowed'
  | 'missing_permission'
  | 'policy_forbidden'
  | 'policy_inconclusive'
  | 'invalid_scope'

type AuthorizationFilter = Record<string, unknown>

type FieldAuthorization = {
  readable: readonly string[] | '*'
  writable: readonly string[] | '*'
  filterable: readonly string[] | '*'
  sortable: readonly string[] | '*'
}

type IAccessControlModuleService = {
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>
  authorizeOrThrow(request: AuthorizationRequest): Promise<void>
  scope(request: AuthorizationRequest): Promise<AuthorizationFilter>
  fields(request: AuthorizationRequest): Promise<FieldAuthorization>
}
```

The actual TypeScript design must make `scope` generic over the owning resource's filter type rather
than casting arbitrary records. The sketch shows responsibilities, not permission to introduce
`any` or leak ORM expressions into `core`.

`authorize` handles an action with known facts. `scope` compiles the same policies into an
ORM-neutral filter suitable for list and detail queries. `fields` controls reads, writes, filters and
sorts. Callers use the narrowest method appropriate to the operation.

### Registration contract

Resource modules register permission metadata and policies through a bootstrap declaration. They
import only core access-control types. The framework owns registration and validation; a resource
module never imports the access-control module's repositories or models.

Registration fails startup when:

- two declarations use the same permission or policy id inconsistently;
- a policy references an unregistered resource or action;
- a filter policy emits an unsupported operator or field;
- a field policy names an unknown field; or
- a mandatory policy has no evaluator.

This makes policy drift a deployment failure instead of a production authorization gap.

---

## Data Model

The first release owns four entities inside the `access-control` module.

### Permission

```text
permission
  id                prefixed primary key
  key               immutable unique capability key
  module            owning module id
  name              display label
  description       display description
  assignable        whether an administrator may grant it
  registered_at     last successful catalogue synchronization
  created_at
  updated_at
  deleted_at
```

The row mirrors a code declaration. Administrators cannot create arbitrary permission keys or edit
their semantics.

### Role

```text
role
  id
  name
  description
  protected         prevents destructive edits to system roles
  created_at
  updated_at
  deleted_at
```

Active role names are unique. Role ids, not names, are referenced by assignments.

### Role permission

```text
role_permission
  id
  role_id
  permission_id
  created_at
  deleted_at
```

An active `(role_id, permission_id)` pair is unique.

### Actor role assignment

```text
actor_role_assignment
  id
  actor_type
  actor_id
  role_id
  expires_at        nullable; reserved for temporary assignments
  created_at
  updated_at
  deleted_at
```

Phase 1 accepts only `actor_type = user`, so `actor_id` contains a user id. The generic names match
the authorization request vocabulary and preserve room for service accounts or customer roles.
`actor_id` is an opaque external id with no ORM relationship to the user module, preserving module
isolation. The access-control module validates role existence; workflows validate the external
actor when creating an assignment.

No policy conditions or executable expressions are stored in these tables.

---

## Enforcement

### Enforcement belongs below transport

HTTP middleware may reject requests early and provides useful route metadata, but it is not the only
security boundary. Workflows, workers, subscribers and internal callers can bypass routes.

Every protected use case therefore authorizes at the application boundary that owns the operation:

- route metadata or middleware performs an early capability check;
- the resource service or workflow performs the authoritative check;
- repositories receive authorization filters for reads; and
- field policies are applied before accepting writes and before serializing responses.

Duplicate early and authoritative checks are acceptable. A route-only check is not.

### Read one

The resource module combines caller filters with `scope(request)` using `$and`, then retrieves the
record. A record outside the authorization scope behaves as not found. This avoids leaking its
existence.

### Read many

The authorization filter is merged into the database query before pagination and counting. Proteus
must never fetch a broad result and remove forbidden records in memory; doing so leaks counts,
breaks pagination and wastes data access.

Authorization filters use Proteus's operator-based filter vocabulary from ADR 0008. They do not
contain Drizzle `SQL` objects. If a relationship cannot be represented by the shared filter
operators, the resource module supplies a named policy-filter adapter or repository method while
keeping the public authorization contract ORM-neutral.

### Create

The actor, input fields, claims and scope are authorized before insertion. If authorization depends
on server-computed attributes, the application performs the final check inside the same module
transaction before commit.

### Update and delete

The record is loaded through the authorization scope. Updates are checked against both the current
record and the proposed field changes. Protected fields are rejected, not silently discarded.

### Cross-module operations

Cross-module mutations remain workflows. The workflow resolves the public authorization service,
checks the operation and then calls public module services. A policy that needs cross-module facts
uses a registered relationship resolver or link service; it never reaches into another module's
repository.

### Background and system actors

Jobs and subscribers use explicit actor types such as `system` or `service`. They do not skip
authorization because no HTTP user exists. Each system actor receives narrowly registered
capabilities. A global bypass is reserved for bootstrap, repair and migration paths and is audited.

### Error semantics

- Missing or invalid authentication returns `401 Unauthorized`.
- A known action denied independently of a particular record returns `403 Forbidden`.
- A record excluded by an authorization filter returns `404 Not Found`.
- Public responses do not include policy ids, role ids or sensitive reasons.
- Structured internal logs retain the decision reason and correlation data.

---

## Policies Beyond RBAC

The following cases must fit the contract without new authorization call sites.

| Requirement | Source of truth | Policy form |
|---|---|---|
| `tenantId` or `organizationId` | active trusted scope plus resource field | scope and filter policy |
| verified email or domain | refreshed identity claim | actor claim check |
| delegated or impersonated session | trusted session context | session claim check |
| record ownership | resource owner field | resource check and query filter |
| project or team membership | membership module or link | relationship check and query filter |
| order belongs to user's store | store assignment plus order relation | relationship filter |
| record status | resource attributes | resource check and query filter |
| customer segment | customer or segment relationship | relationship check |

### Claims

Claims are normalized by trusted claim providers. Policy code consumes stable names such as
`emailVerified`, `emailDomain`, `delegated` and `impersonated`; it does not parse provider-specific
JWT payloads. Security-sensitive claims that may change during a session must be refreshed or backed
by short-lived tokens.

### Relationships

Relationship resolvers answer named questions such as `member_of_project`, `assigned_to_store` or
`in_customer_segment`. They are registered by the module that owns the relationship and may produce
either a boolean for one record or a filter constraint for a query.

Resolvers must batch queries and must not create an N+1 check per result row.

### Resource attributes

The module that owns a resource defines which attributes a policy may inspect and filter. Policy
code cannot name arbitrary database columns. Status and ownership checks use this declared schema.

### Field policies

Field policies independently control:

- fields returned in a response;
- fields accepted on create;
- fields accepted on update;
- fields allowed in filters; and
- fields allowed in sort expressions.

Filtering or sorting by an unreadable field is denied because it can reveal protected values through
side channels. Missing field policy information fails closed.

---

## Role Administration

The initial admin surface includes:

- list registered permissions;
- create, read, update and soft-delete roles;
- replace a role's permission set atomically;
- list a user's roles;
- replace a user's role assignments atomically; and
- inspect effective permission keys for troubleshooting.

Only a protected bootstrap role can initially manage roles and assignments. The permission keys for
this surface are themselves registered permissions. The last active holder of the protected
administration role cannot remove or disable their own ability to manage access.

Changes to roles, role permissions and assignments emit audit events containing the operator,
target, before/after values, scope and request correlation id.

The API must use the existing admin namespace authentication. Request and response schemas live in
`@proteus/http-schemas`; route handlers orchestrate and delegate rather than contain policy logic.

---

## Caching and Consistency

Effective role grants may be cached by `(actor type, actor id, scope, authorization
version)`. Role, role-permission and assignment mutations increment the affected authorization
version and invalidate local cache entries.

Correctness cannot depend on a long TTL. Revocation must become effective across processes within a
documented short bound. The first release may omit caching until profiling proves it necessary; the
service contract does not expose cache behavior.

Claims and relationship facts have separate lifetimes and must not be hidden inside the role-grant
cache.

---

## Security Invariants

1. Default deny: no matching grant means no access.
2. Unknown permission, policy, field or filter operator fails closed.
3. Role names never authorize requests.
4. Request data never becomes a trusted claim merely because it is present in a token or header.
5. Authorization filters are applied before count and pagination.
6. A forbidden record is not loaded and then hidden when a scoped query can avoid loading it.
7. Field restrictions cover reads, writes, filters and sorts.
8. Multi-role union cannot bypass mandatory resource policies.
9. Policy evaluation errors deny access and are reported internally.
10. System bypass is explicit, narrow and audited.
11. Access-control tables follow Proteus soft-delete and prefixed-id conventions.
12. No access-control entity has a direct ORM relationship to an entity in another module.

---

## Delivery Plan

### Phase 1: granular RBAC

- Add core authorization types and the `IAccessControlModuleService` port.
- Add the access-control module and its four entities.
- Add code registration and startup synchronization of permission metadata.
- Add role, permission-assignment and actor-role APIs.
- Add the trusted `AuthContext` to `AuthorizationActor` adapter.
- Add default-deny capability enforcement for admin routes and authoritative use cases.
- Seed a protected bootstrap administration role and assign it during initialization.
- Add decision diagnostics and mutation audit events.
- Add limited-role integration and end-to-end personas.

Phase 1 uses only system scope. It does not pretend that every current API becomes protected in one
unguarded migration. The implementation plan must inventory admin actions, register their keys and
make the cutover atomic: routes cannot become default-deny before their permission catalogue and
bootstrap assignment exist.

### Phase 2: policy constraints

- Add simple actor and session claim checks.
- Add resource attribute checks.
- Add query-filter compilation through the core filter vocabulary.
- Replace manual ownership checks with registered policies.
- Add relationship resolvers for project, team, store and customer-segment facts as those modules
  require them.
- Add field policies.

### Phase 3: scoped tenancy

- Add organization or tenant membership and active-scope selection.
- Add scope to role assignments so a grant applies only inside its organization or tenant.
- Add organization ownership to role definitions only if tenants may create private custom roles.
- Require scope constraints on every tenant-owned query and mutation.
- Evaluate PostgreSQL RLS as defense in depth after application-level scope enforcement is complete.

Permissions remain global code-defined capabilities. Role definitions may also remain global
templates shared by every tenant. The assignment is normally the scoped fact: a user is an order
manager in organization A, not everywhere. A nullable organization id on a role is needed only when
the product allows both platform-owned roles and tenant-owned custom roles. That decision belongs to
the tenancy design and is not pre-modelled with generic `scope_type` and `scope_id` columns.

RLS is not the policy engine. If introduced, it protects tenant boundaries only and remains behind
the repository/runtime adapter boundary.

---

## Testing Decisions

### Unit tests

- Multiple role grants form a union.
- Missing grants deny.
- Expired and soft-deleted assignments do not grant.
- Scope mismatches deny.
- Every applicable policy must pass.
- Inconclusive and failed policy evaluation denies.
- Mandatory constraints survive the addition of a broader role.
- Field permissions fail closed.
- Permission registry conflicts fail startup.

### Module integration tests

- Permission synchronization is idempotent.
- Roles and assignments respect uniqueness and soft deletion.
- Replacing permissions or assignments is atomic.
- Protected roles cannot be deleted or stripped unsafely.
- Revocation invalidates effective grants.
- Opaque actor ids do not create cross-module ORM dependencies.

### API integration tests

- Unauthenticated requests return `401`.
- Authenticated users without the permission receive `403`.
- Limited users can perform granted actions and cannot perform adjacent actions.
- Role-management endpoints require their own permissions.
- Scoped detail reads return `404` for excluded records.
- Scoped lists filter before count and pagination.
- Forbidden write fields are rejected.

### End-to-end tests

- A full administrator retains existing admin behavior after cutover.
- A catalogue-only administrator can manage catalogue data but cannot access users, orders or
  payments.
- Revoking a role removes the corresponding navigation and backend access.
- Navigation hiding is treated as presentation only; direct API calls remain denied.

---

## Acceptance Criteria

1. A user can hold multiple roles and receives the union of their registered permission grants.
2. A backend action checks an immutable permission key, never a role name.
3. A user with no matching permission is denied by default.
4. Role and assignment administration is itself permission-protected and audited.
5. The service contract accepts actor, action, resource, scope and context even though phase 1 uses
   only system scope and RBAC grants.
6. The contract exposes separate decision, query-scope and field-policy operations.
7. Authorization filters are ORM-neutral and compatible with Proteus's repository filter boundary.
8. No policy expression supplied through an admin API is executed.
9. No direct ORM relationship crosses from access control to user or another module.
10. At least one limited-admin E2E persona proves that UI visibility and backend enforcement agree.
11. Tests prove that a broad additional role cannot bypass a mandatory resource policy.
12. A future organization scope, verified-email claim, impersonation restriction, ownership rule,
    team membership, store relation, record status or customer segment can be added by registering a
    provider or policy, without changing existing authorization call sites.

## Open Implementation Questions

These are implementation choices, not unresolved product semantics:

1. Whether permission declarations attach to module definitions directly or use a parallel
   bootstrap registry.
2. The exact generic TypeScript shape that lets `scope` return a resource's filter type without
   weakening it to `any`.
3. Whether the initial decision engine is a small Proteus implementation or an adapter over an
   external library. The public port must make that choice replaceable.
4. Which event-bus delivery level is appropriate for audit events and cross-process cache
   invalidation.
5. Whether `expires_at` ships active in phase 1 or remains reserved until temporary roles have UI.

## References

- [Ash: Authorize access to resources](https://ash.hexdocs.pm/3.17.0/authorize-access-to-resources.html)
- [Ash policies](https://hexdocs.pm/ash/policies.html)
- [ADR 0001: Per-module container isolation](../adr/0001-per-module-container-isolation.md)
- [ADR 0004: Link modules for cross-module joins](../adr/0004-link-modules-for-cross-module-joins.md)
- [ADR 0008: Operator-based filter system](../adr/0008-operator-based-filter-system.md)
- [ADR 0009: Workflow engine and step pattern](../adr/0009-workflow-engine-and-step-pattern.md)
- [ADR 0012: Single auth identity per email with multi-role support](../adr/0012-single-auth-identity-per-email.md)
- [ADR 0026: `core/` is what is known, `framework/` is what runs](../adr/0026-core-is-known-framework-runs.md)
- [ADR 0027: The backend layer graph is default-deny](../adr/0027-the-backend-layer-graph-is-default-deny.md)
