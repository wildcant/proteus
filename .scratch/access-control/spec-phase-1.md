# Access Control — Phase 1: Granular RBAC

**Status:** proposed

This is the implementation spec for Phase 1 of the access-control system described in
`docs/specs/access-control.md`. It covers granular role-based access control for the admin
application: backend permission enforcement, the access-control module, admin UI for role
management, and nav-level permission gating.

---

## Problem Statement

Every authenticated admin user currently has unrestricted access to the entire admin API. There are
68 admin route files across 21 resource areas, none of which check permissions. Businesses that need
role separation — catalogue editor, order operator, support agent, finance manager — have no way to
restrict what an admin user can do.

## Solution

Administrators create roles, assign registered permission keys to them, and assign one or more roles
to admin users. The backend enforces permissions at two layers: an early route-level middleware check
and an authoritative module-level service check. The admin frontend hides unauthorized navigation
items and action buttons based on server-computed allowed actions. A protected super admin role
grants all permissions and cannot be removed while it is the last holder.

## User Stories

1. As a system administrator, I want to create a custom role from registered permissions so I can
   separate responsibilities without code changes.
2. As a system administrator, I want to assign several roles to a user so their effective permissions
   are the union of all assigned roles.
3. As a system administrator, I want to remove a role from a user so I can revoke access immediately.
4. As a system administrator, I want to view a list of all roles with their user counts so I can
   understand the current access landscape.
5. As a system administrator, I want to edit a role's name, description, and permissions so I can
   adjust access as the team's needs change.
6. As a system administrator, I want to delete a role so I can clean up roles that are no longer
   needed.
7. As a system administrator, I want the system to prevent deletion of the last super admin
   assignment so I cannot lock myself out.
8. As a system administrator, I want to see which roles a user holds on the user edit page so I can
   manage their access in context.
9. As a system administrator, I want to assign roles to a user via a tag input on the user edit page
   so role management is fast.
10. As a catalogue editor, I want to manage products, product options, and images without seeing
    users, orders, or payments so I focus on my responsibility.
11. As a catalogue editor, I want the admin sidebar to show only the sections I have access to so I
    am not confused by pages I cannot use.
12. As a catalogue editor, I want to see a clear 403 error if I navigate directly to a restricted
    page so I understand why I cannot access it.
13. As a developer, I want to declare permission keys beside the module that owns them so permissions
    stay co-located with enforcement.
14. As a developer, I want permission keys to be typed with Template Literal Types so typos in
    permission strings are caught at compile time.
15. As a developer, I want to use the same `authorizeOrThrow` call for HTTP routes, workflows,
    subscribers, and background jobs so authorization is consistent across all entry points.
16. As a developer, I want authorization context to travel on the existing `Context` object so I do
    not need to plumb a new parameter through every service method.
17. As a developer, I want startup to synchronize code-registered permissions to the database so the
    admin UI always reflects the current permission catalogue.
18. As a developer, I want startup to error if a removed permission key is still assigned to a role
    so I catch stale grants at deploy time.
19. As a developer, I want the authorization engine to be a small custom implementation behind a port
    so it can be swapped for CASL, Oso, or Cedar later without changing callers.
20. As a developer, I want module wildcards (`product.*`) to use prefix matching so a single grant
    covers all permissions in a module.
21. As a developer, I want the super admin role to store `'*'` and have the engine match it as a
    global wildcard so no sync step is needed when new permissions are registered.
22. As a background job, I want to use an `unrestricted: true` context so system operations are not
    blocked by RBAC while remaining distinguishable from user-initiated actions in future audit logs.
23. As a security operator, I want every admin route to require an explicit permission declaration so
    no route is accidentally left unprotected.
24. As a security operator, I want the super admin role to be fully immutable (name, permissions)
    through the admin API so only code deployments can change its definition.
25. As a user, I want to always be able to read my own profile via `/admin/users/me` without needing
    `user.read` permission so I am never locked out of seeing who I am.
26. As a user, I want to see my role names in the avatar menu so I have quick confirmation of my
    access level.

## Implementation Decisions

### Permission key format

Keys follow `model.action` for main models and `module.submodel.action` for sub-models:

```
product.read          — main model, product module
user.invite.create    — sub-model, user module
access-control.role.manage — sub-model, access-control module
```

Module wildcards use string prefix matching via `matchFeature`:

- `product.*` matches `product.read`, `product.create`, etc.
- `user.*` matches `user.read`, `user.invite.read`, etc.
- `'*'` matches everything.

Permission keys are typed with a fully closed Template Literal union. The `PermissionGrant` type
extends with wildcards for storage:

```typescript
type PermissionKey = ProductPermission | OrderPermission | CustomerPermission | ...
type ModuleWildcard = `${ModuleId}.*`
type PermissionGrant = PermissionKey | ModuleWildcard | '*'
```

### Permission key inventory (42 keys, 12 modules)

**product** — `product.read`, `product.create`, `product.update`, `product.delete`

**order** — `order.read`, `order.complete`, `order.cancel`, `order.archive`, `order.fulfill`,
`order.ship`, `order.deliver`

**customer** — `customer.read`, `customer.create`, `customer.update`, `customer.delete`

**payment** — `payment.read`, `payment.capture`, `payment.refund`

**fulfillment** — `fulfillment.read`, `fulfillment.create`, `fulfillment.update`,
`fulfillment.delete`

**inventory** — `inventory.read`

**region** — `region.read`, `region.create`, `region.update`

**store** — `store.read`, `store.update`

**user** — `user.read`, `user.create`, `user.update`, `user.delete`, `user.invite.read`,
`user.invite.create`, `user.invite.delete`, `user.invite.resend`

**notification** — `notification.read`

**file** — `file.upload.read`, `file.upload.create`, `file.upload.delete`

**access-control** — `access-control.role.read`, `access-control.role.manage`,
`access-control.assignment.read`, `access-control.assignment.manage`

Sub-resource operations collapse into the parent model action for Phase 1. Product option
operations require `product.read`/`product.update`. Payment collection operations require
`payment.read`. Region country management requires `region.update`. Store currency management
requires `store.update`. Finer granularity can be added later by registering new sub-model keys
(the module wildcard will still cover them).

### Permission registration

Modules declare a `features` array on their `Module()` definition:

```typescript
export default Module(Modules.PRODUCT, {
  service: ProductModuleService,
  repositories: { ... },
  models: { ... },
  features: [
    { id: 'product.read', title: 'View products' },
    { id: 'product.create', title: 'Create products' },
    { id: 'product.update', title: 'Edit products' },
    { id: 'product.delete', title: 'Delete products' },
  ],
})
```

The `features` property is optional on `ModuleDefinition`. The `id` field is typed as
`PermissionKey`. The `title` field is the human-readable label shown in the role editor UI.

`bootstrapModule` collects features from all modules into a shared permission registry. Duplicate
feature ids across modules fail startup with an error identifying the conflicting modules.

On startup, the access-control module's sync loader synchronizes this registry to the `permission`
database table:

- **New key in code, not in DB:** upsert row with current title, module, and `registered_at`.
- **Existing key, title changed:** update title and `registered_at`.
- **Key in DB, not in code, unassigned:** soft-delete the permission row.
- **Key in DB, not in code, still assigned to a role:** error at startup. The developer must
  either restore the key or migrate the role's `features_json` before deploying. This prevents
  stale grants from silently persisting.
- **Key in DB, soft-deleted, now re-registered:** restore the row (clear `deleted_at`).

### Data model

Three entities inside the access-control module. `ACCESS_CONTROL` must be added to the `Modules`
const in `core/utils/modules-definition.ts`.

**permission** — mirrors the code-registered feature catalogue.

```
permission
  id              text PK (prefixed: perm_)
  key             text NOT NULL — immutable capability key
  module          text NOT NULL — owning module id
  title           text NOT NULL — display label
  description     text — nullable
  assignable      boolean NOT NULL DEFAULT true
  registered_at   timestamptz — last startup sync
  created_at      timestamptz
  updated_at      timestamptz
  deleted_at      timestamptz

  liveUniqueIndex (key) WHERE deleted_at IS NULL
```

The `key` column uses a partial unique index (`liveUniqueIndex`) so a soft-deleted permission's
key can be re-registered. Administrators cannot create or edit permission keys. Rows are managed
exclusively by startup synchronization.

**role**

```
role
  id              text PK (prefixed: role_)
  name            text NOT NULL
  description     text — nullable
  is_super_admin  boolean NOT NULL DEFAULT false
  protected       boolean NOT NULL DEFAULT false
  features_json   jsonb NOT NULL DEFAULT '[]' — array of PermissionGrant strings
  created_at      timestamptz
  updated_at      timestamptz
  deleted_at      timestamptz

  liveUniqueIndex (name) WHERE deleted_at IS NULL
```

`features_json` stores an array of `PermissionGrant` values: concrete keys like `product.read`,
module wildcards like `order.*`, or `'*'` for super admin. This is the sole source of truth for
what a role grants. There is no denormalized join table — the engine expands wildcards at resolve
time using the in-memory permission registry.

When an admin checks the "All" checkbox for a module in the role editor, the UI stores the
wildcard `module.*` (e.g. `['product.*']`), not the expanded individual keys. This means newly
registered permissions under that module are automatically covered without updating the role.
When an admin picks individual actions without the "All" checkbox, concrete keys are stored
(e.g. `['product.read', 'product.create']`).

The super admin role has `is_super_admin = true`, `protected = true`, and
`features_json = ['*']`. It is fully immutable through the admin API: name, permissions, and
the `is_super_admin` flag cannot be changed. Only code deployments can modify its definition.

Regular protected roles (`protected = true`, `is_super_admin = false`) cannot be deleted or
renamed but their permissions can be edited.

**actor_role_assignment** — polymorphic actor-role link inside the access-control module.

```
actor_role_assignment
  id              text PK (prefixed: ara_)
  actor_type      text NOT NULL — 'user' in Phase 1
  actor_id        text NOT NULL — opaque external id (e.g. user id)
  role_id         text FK -> role.id
  expires_at      timestamptz — nullable, reserved for Phase 2
  created_at      timestamptz
  updated_at      timestamptz
  deleted_at      timestamptz

  liveUniqueIndex (actor_type, actor_id, role_id) WHERE deleted_at IS NULL
```

`actor_id` is opaque — no ORM relationship to the user module. Phase 1 validates
`actor_type = 'user'` only. The `expires_at` column exists but is not enforced in queries.

### Authorization engine

A custom decision engine behind the `IAccessControlModuleService` port, inspired by
open-mercato's `featurePolicy.ts` and `featureMatch.ts`.

Core functions in `core/access-control/`:

**`matchFeature(required, granted)`** — returns true if a single granted permission satisfies a
required one. Handles `'*'` (global wildcard), `'module.*'` (prefix wildcard), and exact match.
Note: parameter order is `(required, granted)` — "does this grant satisfy this requirement?"

**`hasFeature(granted[], required)`** — returns true if any grant in the array satisfies the
required key. Note: parameter order flips to `(grantedArray, requiredKey)` — "does this set
of grants cover this requirement?" This matches open-mercato's convention.

**`hasAllFeatures(granted[], required[])`** — returns true if every requirement is satisfied
by at least one grant in the set.

**`authorizeFeatures(required[], subject)`** — main authorization check. Short-circuits on
`unrestricted: true`. Checks that all required features belong to enabled modules, then
delegates to `hasAllFeatures`.

**`resolveEffectiveFeatures(granted[])`** — expands wildcards to concrete permission keys
for the nav payload. Used server-side before sending allowed actions to the frontend. Reads
concrete feature ids from the in-memory permission registry (collected at bootstrap from all
modules' `features` arrays). Output contains only concrete keys — no wildcards.

**`filterGrantsByEnabledModules(granted[])`** — expands `'*'` to per-enabled-module wildcards
(`product.*`, `order.*`, etc.) and filters out grants from disabled modules. In Phase 1 all
modules are enabled; the filter is still applied for structural correctness.

### Service contract

```typescript
type IAccessControlModuleService = {
  authorize(request: AuthorizationRequest): Promise<AuthorizationDecision>
  authorizeOrThrow(request: AuthorizationRequest): Promise<void>
  scope(request: AuthorizationRequest): Promise<AuthorizationFilter>
  fields(request: AuthorizationRequest): Promise<FieldAuthorization>

  // Role CRUD
  createRole(data: CreateRoleDTO): Promise<RoleDTO>
  updateRole(id: string, data: UpdateRoleDTO): Promise<RoleDTO>
  deleteRole(id: string): Promise<void>
  listRoles(filters?, config?): Promise<RoleDTO[]>
  retrieveRole(id: string, config?): Promise<RoleDTO>

  // Permission listing (read-only)
  listPermissions(filters?, config?): Promise<PermissionDTO[]>
  retrievePermission(id: string): Promise<PermissionDTO>

  // Actor role assignment
  assignRoles(actorType: string, actorId: string, roleIds: string[]): Promise<void>
  revokeRoles(actorType: string, actorId: string, roleIds: string[]): Promise<void>
  replaceRoles(actorType: string, actorId: string, roleIds: string[]): Promise<void>
  listActorRoles(actorType: string, actorId: string): Promise<RoleDTO[]>

  // Permission resolution
  resolvePermissions(actorType: string, actorId: string): Promise<PermissionGrant[]>
  resolveEffectiveFeatures(actorType: string, actorId: string): Promise<PermissionKey[]>

  // Sync
  syncPermissions(features: FeatureDeclaration[]): Promise<void>
}
```

Phase 1 ships all four authorization methods. `scope()` returns `undefined` (no filter applied;
the caller's own filters are used unmodified). `fields()` returns
`{ readable: '*', writable: '*', filterable: '*', sortable: '*' }`. Both serve as integration
points for Phase 2 without requiring caller changes.

### Authorization request vocabulary

Types live in `core/access-control/` and `core/types/access-control/`.

```typescript
type AuthorizationRequest = {
  actor: AuthorizationActor
  action: string
  resource: { type: string; id?: string }
  scope: AuthorizationScope
  context: AuthorizationContext
}

type AuthorizationActor = {
  id: string
  type: string
  claims: Readonly<Record<string, unknown>>
  grantedFeatures: readonly string[]
  unrestricted?: boolean
}

type AuthorizationScope = { type: 'system' } | { type: string; id: string }

type AuthorizationContext = {
  session: {
    id?: string
    authenticationMethod?: string
    delegatedByActorId?: string
    impersonatedByActorId?: string
  }
  now: Date
}

type AuthorizationDecision = {
  allowed: boolean
  reason: 'allowed' | 'missing_permission' | 'policy_forbidden' | 'policy_inconclusive'
  matchedRoleIds: readonly string[]
}
```

Phase 1 always uses `{ type: 'system' }` scope. The vocabulary is designed so Phase 2 claims,
relationships, and scope constraints plug in without changing existing call sites.

### Actor context threading

The existing `Context` type is extended with an optional `actor` field:

```typescript
type Context = {
  transaction?: unknown
  actor?: AuthorizationActor
}
```

Route middleware builds the actor from `AuthContext` and attaches it as `req.authorizationActor`.
Route handlers pass it into service calls via context. Workflows and subscribers pass context
explicitly. Background jobs construct a system actor with `unrestricted: true`.

The system actor must be documented as a distinct type from user actors so that future audit logs
can differentiate platform-initiated changes from user-initiated changes.

### Dual enforcement

Two enforcement layers serve different purposes:

**Route-level (early).** A `permissions` array on `RouteDefinition` declares required permission
keys. When multiple keys are listed, ALL are required (AND semantics). Authorization middleware
checks before the handler runs. Fast 403 with no DB load. Covers HTTP entry points only.

The authorization middleware (`authorize.ts`) runs after `authorization-actor.ts`. It queries
the database on every request to resolve the actor's granted features (single indexed join on
`actor_role_assignment` + `role`). The resolved `grantedFeatures` array is populated on
`req.authorizationActor` before the permission check runs. No cache — one DB round trip per
request.

**Module-level (authoritative).** Service or workflow calls `authorizeOrThrow()` internally. Covers
all entry points: routes, workflows, subscribers, background jobs, internal callers. This is the
security boundary.

A route-only check is never sufficient. The authoritative check lives at the module service level.
Duplicate early and authoritative checks are acceptable — a missing authoritative check is not.

Every admin route with `auth: 'required'` (the default) must declare a `permissions` array.
Routes with `auth: 'public'` or `auth: 'unregistered'` are exempt from permission enforcement
and from the startup validation check. Routes without `permissions` on `auth: 'required'` fail
startup validation, preventing deployment with unprotected endpoints.

### Error responses

A denied request returns HTTP 403 with the standard error shape:
`AppError({ type: ErrorTypes.FORBIDDEN, message: 'Insufficient permissions' })`. The response
body does not include the missing permission key, role ids, or other sensitive authorization
details (per the product spec: "public responses do not include policy ids, role ids or sensitive
reasons"). Internal structured logs include the missing permission key and actor id for debugging.

### Self-read bypass

`GET /admin/users/me` is always allowed for authenticated users without a permission check. This
is a session property, not a permission grant. Reading other users via `/admin/users/:id`
requires `user.read`.

### Super admin bypass

The super admin role stores `features_json = ['*']`. The engine's `matchFeature('*', anything)`
returns true. No permission sync is needed when new keys are registered.

`filterGrantsByEnabledModules` expands `'*'` into per-enabled-module wildcards:

```typescript
if (grant === '*') {
  for (const id of enabledModuleIds) result.push(`${id}.*`)
}
```

In Phase 1 all modules are enabled. When pricing tiers introduce module toggling, disabled modules
are excluded from expansion and their permissions become inaccessible even for super admins.

### Self-escalation prevention

Assigning the super admin role requires the caller to already hold super admin. The service
checks: if `roleIds` includes the super admin role, the calling actor must themselves be assigned
to the super admin role. Otherwise the request is rejected with 403. This prevents any user with
`access-control.assignment.manage` from escalating themselves or others to full access.

Same pattern as the existing rule that only code deployments can modify the super admin role's
definition — super admin is a trust boundary, not just another role.

### Last admin standing protection

The service prevents:
- Removing the last actor_role_assignment to the super admin role.
- Deleting the super admin role (blocked by `protected` flag).
- Modifying the super admin role's name or permissions (blocked by `is_super_admin` flag).

Enforcement is in the service layer, not the route handler.

### Seeding

The dev seed script (`scripts/seed-dev.ts`) is extended to:
1. Create the super admin role with `is_super_admin = true`, `protected = true`,
   `features_json = ['*']`.
2. Assign the dev admin user (`admin@example.com`) to the super admin role.
3. Optionally create a "Catalogue Editor" role with `['product.*']` for testing restricted access.

No data migration is needed since the application is not in production.

### Caching

No cache in Phase 1. Permission resolution is a single indexed join query that returns the
`features_json` arrays from all roles assigned to an actor:

```sql
SELECT r.features_json
FROM actor_role_assignment ara
JOIN role r ON r.id = ara.role_id
WHERE ara.actor_type = $1
  AND ara.actor_id = $2
  AND ara.deleted_at IS NULL
  AND r.deleted_at IS NULL
```

The service merges all `features_json` arrays into a single flat `PermissionGrant[]` set (union
of all role grants). The engine then uses `matchFeature` against this set for authorization
checks, and `resolveEffectiveFeatures` to expand wildcards for the nav payload.

Profile under load. Add in-memory cache keyed by `(actor_type, actor_id)` with short TTL if
queries become a bottleneck.

### Admin API routes

**Permission routes (read-only)**

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/admin/permissions` | `access-control.role.read` | List registered permissions |
| GET | `/admin/permissions/:id` | `access-control.role.read` | Get permission detail |

**Role routes**

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/admin/roles` | `access-control.role.read` | List roles |
| POST | `/admin/roles` | `access-control.role.manage` | Create role |
| GET | `/admin/roles/:id` | `access-control.role.read` | Get role detail |
| PATCH | `/admin/roles/:id` | `access-control.role.manage` | Update role |
| DELETE | `/admin/roles/:id` | `access-control.role.manage` | Delete role |

**User role assignment routes**

| Method | Path | Permission | Purpose |
|--------|------|------------|---------|
| GET | `/admin/users/:id/roles` | `access-control.assignment.read` | List user's roles |
| PUT | `/admin/users/:id/roles` | `access-control.assignment.manage` | Replace user's roles |

### API request and response schemas

**`POST /admin/roles` — create role**

Request: `{ name: string, description?: string, features: PermissionGrant[] }`
Response: `{ role: RoleResponse }`

**`PATCH /admin/roles/:id` — update role**

Request: `{ name?: string, description?: string, features?: PermissionGrant[] }`
Response: `{ role: RoleResponse }`

Validation: `name` required on create, minimum 1 character. `features` must contain valid
`PermissionGrant` values (concrete keys, module wildcards, or `'*'`). Invalid grant strings
rejected with 400.

**`DELETE /admin/roles/:id`**

Response: 200 on success. 400 if role is protected. 400 if role has active assignments (message
includes user count: `"Cannot delete role with N active assignments. Reassign users first."`).
404 if not found.

**`GET /admin/roles`**

Response: `{ roles: RoleResponse[] }`

**`GET /admin/roles/:id`**

Response: `{ role: RoleResponse & { userCount: number } }`

**`PUT /admin/users/:id/roles` — replace user's roles**

Request: `{ roleIds: string[] }`
Response: `{ roles: RoleResponse[] }`

Validation: all role ids must exist. Empty array removes all roles (unless last super admin
protection triggers). If `roleIds` includes the super admin role, the caller must hold super
admin — otherwise 403.

**Shared response type:**

```typescript
type RoleResponse = {
  id: string
  name: string
  description: string | null
  isSuperAdmin: boolean
  protected: boolean
  features: PermissionGrant[]
  createdAt: string
  updatedAt: string
}
```

### Nav bootstrap (BFF pattern)

`GET /admin/users/me` is extended to return authorization payload. The route handler resolves
the access-control service from the shared Awilix container
(`container.resolve<IAccessControlModuleService>(Modules.ACCESS_CONTROL)`) — the standard
cross-module pattern used throughout the codebase (e.g. seed script, workflow steps).

```typescript
type AdminMeResponse = {
  user: AdminUser & { roles: { id: string; name: string }[] }
  allowedActions: string[]
  sidebar: SidebarGroup[]
  settingsSidebar: SidebarGroup[]
}

type SidebarGroup = {
  label: string
  icon?: string
  items: { label: string; to: string; icon?: string }[]
}
```

`allowedActions` contains expanded concrete permission keys (no wildcards). The server calls
`resolveEffectiveFeatures` to expand grants before responding.

`sidebar` and `settingsSidebar` contain pre-filtered navigation sections. The server owns nav
filtering — unauthorized items are excluded before the response is sent. The client renders
them as-is without additional filtering. `allowedActions` is still sent for action-level gating
(show/hide buttons, disable form fields) using a client-side `hasFeature(allowedActions, key)`
helper that does exact string matching only — no wildcard logic on the client.

### Permission-to-nav mapping

Each nav item and settings item requires a permission to be visible. The mapping is defined
server-side:

**Main sidebar:**

| Nav item | Required permission |
|----------|-------------------|
| Products | `product.read` |
| Orders | `order.read` |
| Customers | `customer.read` |
| Inventory | `inventory.read` |
| Fulfillment | `fulfillment.read` |

**Settings sidebar:**

| Settings item | Required permission |
|--------------|-------------------|
| Store | `store.read` |
| Users | `user.read` |
| Roles | `access-control.role.read` |
| Regions | `region.read` |
| Workflows | (always visible to authenticated users) |
| Profile | (always visible — self-management) |

Items without a listed permission are always visible. Items gated by a permission are excluded
from the response when the actor lacks that permission.

Re-fetched on window focus to pick up role changes without requiring logout.

### Admin UI — settings pages

New "Auth" group in settings sidebar containing:
- Users (existing page, extended)
- Roles (new page)

#### Roles list page

Table with columns: Role name, Users count, Actions menu. Search bar. Create button. Same pattern
as existing settings list pages.

Protected roles show a lock icon. Super admin role cannot be deleted via the actions menu.

#### Role edit page

- Name field (disabled for super admin and protected roles).
- Description field.
- "Super Admin (all features)" checkbox — visible only to super admin users, read-only visual
  indicator for the super admin role. Non-super-admin roles show the permission grid instead.
- Permission grid: two-column layout, grouped by module. Each group has a title, an "All" checkbox
  (grants `module.*`), and individual permission checkboxes. Each permission shows its title and
  key in grey text.
- Save replaces the role's `features_json` atomically.

Reference: open-mercato role edit page layout.

#### Users list page (extended)

Add "Roles" column showing comma-separated role names. Existing columns (Email, Display name,
Status, Actions) remain.

#### User edit page (extended)

Add "Roles" section below existing fields. Uses the existing `MultiSelectCombobox` component
with role names as items. Tag-style input with dropdown search.

User fields and role assignment are independent saves. The user form submits
`PATCH /admin/users/:id` for user fields. The Roles section submits
`PUT /admin/users/:id/roles` with `{ roleIds: string[] }` for role assignment. Two separate
requests — the Roles section can save independently.

Reference: open-mercato user edit page layout.

#### Nav hiding

Nav filtering is server-side. The `sidebar` and `settingsSidebar` arrays returned by
`GET /admin/users/me` are pre-filtered — unauthorized items never reach the client. The client
renders them as-is. The current hardcoded `navItems` array in `components/layout/nav.tsx` is
replaced by the server-provided structure.

This is presentation only. Direct URL navigation to a restricted page shows a 403 error page.
Backend routes enforce independently.

#### Avatar menu role display

The user avatar dropdown shows the user's role names (e.g. "Super Admin", "Catalogue Editor")
as a badge or subtitle below the user's name.

### Module structure

```
apps/backend/src/
  core/
    access-control/
      types.ts          — AuthorizationRequest, AuthorizationActor, AuthorizationDecision, etc.
      engine.ts         — matchFeature, hasFeature, authorizeFeatures, resolveEffectiveFeatures
      features.ts       — FeatureDeclaration type, permission registry
    types/
      access-control/
        service.ts      — IAccessControlModuleService
        dto.ts          — CreateRoleDTO, RoleDTO, PermissionDTO, etc.
        common.ts       — PermissionKey, PermissionGrant, ModuleWildcard unions
  modules/
    access-control/
      index.ts          — Module(Modules.ACCESS_CONTROL, { ... })
      models/
        permission.ts
        role.ts
        actor-role-assignment.ts
      repositories/
        permission.ts
        role.ts
        actor-role-assignment.ts
      services/
        access-control-module-service.ts
      loaders/
        sync-permissions.ts
      migrations/
        Migration_initial.ts
  api/admin/
    permissions/         — GET list, GET detail
    roles/               — CRUD
    users/
      [id]/
        roles/           — GET, PUT
  framework/
    http/middlewares/
      authorize.ts       — route-level permission check middleware
      authorization-actor.ts — builds AuthorizationActor from AuthContext

apps/admin/src/
  features/
    access-control/
      api/              — query options for roles, permissions
      components/       — RolePermissionGrid, RoleForm, etc.
      hooks/            — useHasFeature, etc.
      types/
  routes/_authed/settings/
    roles/              — list + edit pages
  components/layout/
    nav.tsx             — extended with permission-based filtering
```

### Enabled modules (future-proofing note)

All modules are currently enabled. The `filterGrantsByEnabledModules` function is implemented
but treats all modules as enabled. When pricing tiers introduce module toggling, the function
will filter grants against the active tier's module set. This is documented as a TODO item
and not implemented in Phase 1.

## Testing Decisions

Good tests for this feature verify external behavior at the highest seam possible. They do not
test internal implementation details like cache keys, SQL query shapes, or component render
internals.

### Seam 1: Authorization engine (unit tests)

Pure function tests for `matchFeature`, `hasFeature`, `hasAllFeatures`, `authorizeFeatures`,
and `resolveEffectiveFeatures`. No database, no container. These test the core authorization
logic in isolation.

Test cases:
- `'*'` matches any required permission.
- `'product.*'` matches `product.read` and `product.create` but not `order.read`.
- `'product.*'` matches `product.option.read` (sub-model via prefix).
- Exact match works: `product.read` matches `product.read` only.
- `authorizeFeatures` short-circuits on `unrestricted: true`.
- `authorizeFeatures` returns false when required features come from disabled modules.
- `resolveEffectiveFeatures` expands `'*'` to all concrete keys.
- `resolveEffectiveFeatures` expands `product.*` to all product keys.
- `resolveEffectiveFeatures` does not include wildcards in output.

Prior art: none for pure functions (new pattern), but unit test infrastructure exists.

### Seam 2: Access-control module service (module integration tests)

Test the service against real Postgres, same pattern as `modules/product/__tests__/`. Wire
repositories manually in `beforeEach`, call service methods, assert database state.

Test cases:
- Create, update, soft-delete, and restore roles.
- Role name uniqueness (active roles only).
- Protected role cannot be deleted.
- Super admin role cannot be renamed or have permissions changed.
- Create and revoke actor role assignments.
- Assignment uniqueness (actor_type + actor_id + role_id, active only).
- `resolvePermissions` returns the union of all assigned roles' grants.
- `resolveEffectiveFeatures` expands wildcards to concrete keys.
- `syncPermissions` upserts new keys and updates changed titles.
- `syncPermissions` errors on removal of keys still assigned to a role.
- `syncPermissions` soft-deletes keys no longer in catalogue if unassigned.
- `syncPermissions` restores a soft-deleted key when re-registered.
- Last super admin holder cannot have their assignment revoked.
- Assigning super admin role requires caller to hold super admin.
- Non-super-admin caller assigning super admin role is rejected.
- Deleting a role with active assignments is rejected with user count in error message.
- `replaceRoles` is atomic.
- Duplicate feature ids across modules error during collection.

Prior art: `modules/product/__tests__/product-module-service.test.ts`.

### Seam 3: Admin API routes (API integration tests)

Full HTTP tests via `createApi()` + supertest. Tests make real requests through the middleware
chain against a bootstrapped container with real Postgres.

Test cases:
- Unauthenticated request returns 401.
- Authenticated user without `access-control.role.read` receives 403 on `GET /admin/roles`.
- Authenticated user with `access-control.role.manage` can create, update, delete roles.
- Authenticated user with `access-control.assignment.manage` can replace user's roles.
- Super admin role cannot be deleted or modified via API.
- Last super admin assignment cannot be removed via API.
- Protected role cannot be deleted via API.
- Role with active assignments cannot be deleted via API (400 with user count).
- Non-super-admin user cannot assign super admin role via API (403).
- Super admin user can assign super admin role via API.
- `GET /admin/users/me` returns `allowedActions` and `sidebarGroups`.
- A user with only `product.*` receives only product-related `allowedActions`.
- A user with `'*'` receives all concrete keys in `allowedActions`.
- `GET /admin/users/me` always succeeds for authenticated users (self-read bypass).
- Routes without `permissions` declaration fail startup validation.

Prior art: `api/admin/store/__tests__/store.api.test.ts`.

### Seam 4: Permission registration (bootstrap test)

Test that `bootstrapModule` collects features from module definitions and that the
access-control module's sync loader writes them to the database correctly.

Test cases:
- Features declared on modules are collected into the shared registry.
- Sync upserts all collected features into the permission table.
- Sync errors if a removed feature is still assigned to a role.
- Duplicate feature ids across modules fail startup.

Prior art: existing loader tests in module bootstrap.

### Seam 5: Admin UI (Playwright e2e)

End-to-end tests against real backend. Tests the golden path and critical edge cases.

Test cases:
- Super admin can see all settings pages and manage roles.
- Super admin can create a "Catalogue Editor" role with `product.*` permissions.
- Super admin can assign the "Catalogue Editor" role to a user.
- A catalogue editor sees only product-related sidebar items after login.
- A catalogue editor receives 403 when navigating directly to `/settings/users`.
- A catalogue editor can manage products (create, edit, delete).
- Revoking a role and refreshing the page removes the corresponding navigation.
- The super admin role shows as immutable in the role edit page.
- The last super admin cannot remove their own super admin role.

Prior art: `apps/admin/tests/e2e/products.spec.ts`.

## Out of Scope

- **Audit events and action logs.** Phase 2 will add a dedicated audit log module (likely a
  single table for all mutations with before/after snapshots). The infrastructure decision
  (synchronous writes vs event bus, partitioning strategy) is deferred.
- **Policy constraints (Phase 2).** Actor claim checks, resource attribute checks, ownership
  policies, relationship resolvers, query-filter compilation, and field policies.
- **Scoped tenancy (Phase 3).** Organization/tenant membership, scoped role assignments,
  PostgreSQL row-level security.
- **CASL, Oso, Cedar, or any external policy runtime.** The custom engine is sufficient for
  Phase 1 capability checks. The port makes replacement possible.
- **Per-user permission grants or denies.** Users receive roles, not direct permissions.
- **Role hierarchy or inheritance.** Multiple role assignment provides composition.
- **Customer roles.** Phase 1 covers admin users only (`actor_type = 'user'`).
- **Me/permissions standalone endpoint.** Permissions travel with the `GET /admin/users/me`
  response. No separate endpoint needed.
- **Caching.** Permission resolution uses a single indexed query. Cache added when profiling
  proves necessary.
- **Module enable/disable toggle.** All modules are always enabled. The filtering infrastructure
  is in place for when pricing tiers arrive. Documented as a TODO.
- **`expires_at` enforcement.** Column exists on `actor_role_assignment` but is not checked
  in queries until temporary roles have UI support.

### Acceptance criteria coverage

The product spec (`docs/specs/access-control.md`) defines 12 acceptance criteria. Phase 1
satisfies criteria #1, #2, #3, #5, #6, #7, #8, #9, #10.

- **AC#4** ("permission-protected and audited"): Phase 1 satisfies the permission-protection
  requirement. Audit trail is deferred to Phase 2.
- **AC#11** ("a broad additional role cannot bypass a mandatory resource policy"): This criterion
  applies to Phase 2 policy constraints. Phase 1 tests prove multi-role union semantics work
  correctly (union of grants, no deny rules).
- **AC#12** ("future scope, claim, relationship, etc. can be added without changing call sites"):
  Phase 1 proves the contract by shipping all four methods (`authorize`, `authorizeOrThrow`,
  `scope`, `fields`) with passthrough behavior. The vocabulary accepts all required inputs.

## Further Notes

- The architecture doc (`docs/access-control-module-architecture.md`) remains as research
  reference. It is superseded by `docs/specs/access-control.md` for product decisions and
  by this spec for Phase 1 implementation.
- The `docs/specs/access-control.md` spec defines the full three-phase roadmap. This
  implementation spec covers Phase 1 only and should be read alongside it.
- Open-mercato's security module (`packages/shared/src/security/`) is the primary reference
  for the authorization engine implementation: `featureMatch.ts` for wildcard matching,
  `featurePolicy.ts` for the authorization check, `enabledModulesRegistry.ts` for
  module-aware grant filtering.
- Medusa's `user-rbac-role` link module definition is reference for the cross-module
  relationship pattern, though Proteus uses an entity inside the access-control module
  instead of a link module due to the polymorphic `actor_type` discriminator.
- The 42 permission keys in the inventory cover all 68 existing admin route files. Sub-resource
  operations are collapsed into parent model permissions. New permissions are added by
  registering features on the owning module — the startup sync and UI pick them up
  automatically.
- The enabled-modules TODO should be tracked in `.scratch/access-control/` for the pricing
  tiers feature.
