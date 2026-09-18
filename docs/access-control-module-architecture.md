# Access Control Module Architecture

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Module name | `access-control` | Concrete, distinct from `auth`, doesn't overcommit to a specific model (RBAC/ABAC) |
| Condition interpolation | json-e | Type-safe, no eval, Mozilla-backed, handles edge cases |
| Tenant isolation | PostgreSQL RLS | Unconditional DB guarantee, defense-in-depth |
| Query scoping (lists) | Manual condition-to-where (typed) + RLS | No community lib dependency, type-safe exhaustive patterns |
| Query scoping (mutations) | In-handler CASL check | Entity loaded before check, `throwUnlessCan` |
| Pre-request enforcement | CASL ability built from DB permissions | Condition-free + user-context checks in middleware |
| Inverted rules (`cannot`) | Not supported | Simplicity; deny by absence of permission |
| casl-drizzle | Not used | Bugs with `none()`, weak types, RC dependency |
| DB schema | Normalized multi-table (Medusa-inspired) | Admin-manageable permissions |
| User-role link | Separate link table (not in authz module) | Same pattern as Medusa's `user_rbac_role` |
| Role hierarchy | Not supported | Multiple roles per user covers same use case; avoids recursive CTEs, cycle detection, and hard-to-debug inheritance chains |

---

## 1. Database Schema

### 1.1 Tables

```
permission
──────────────────────────────
id              text PK
action          text NOT NULL        -- "read", "create", "update", "delete", "manage"
subject         text NOT NULL        -- "Product", "Order", "User"
conditions      jsonb                -- json-e template: { "author_id": { "$eval": "user.id" } }
fields          jsonb                -- ["title", "price"] for field-level (nullable)
reason          text                 -- human-readable denial message (nullable)
name            text                 -- admin-friendly label (nullable)
description     text                 -- (nullable)
created_at      timestamptz
updated_at      timestamptz
deleted_at      timestamptz          -- soft delete

-- Prevents duplicate permission definitions. Two permissions with the same
-- action, subject, and conditions hash are semantically identical, so the
-- unique index avoids redundant rows while still allowing re-creation after
-- soft delete (the WHERE deleted_at IS NULL partial index).
UNIQUE INDEX (action, subject, conditions_hash) WHERE deleted_at IS NULL

INDEX (subject) WHERE deleted_at IS NULL
INDEX (action) WHERE deleted_at IS NULL
```

```
role
──────────────────────────────
id              text PK
name            text NOT NULL
description     text                 -- (nullable)
created_at      timestamptz
updated_at      timestamptz
deleted_at      timestamptz

-- Role names are user-facing identifiers (e.g. "Editor", "Viewer") and must
-- be unique to avoid confusion in the admin UI. The partial index allows a
-- soft-deleted role's name to be reused by a new role.
UNIQUE INDEX (name) WHERE deleted_at IS NULL
```

```
role_permission
──────────────────────────────
id              text PK
role_id         text FK -> role.id
permission_id   text FK -> permission.id
created_at      timestamptz
updated_at      timestamptz
deleted_at      timestamptz

-- A role should only grant a given permission once. Without this constraint
-- the same permission could be linked multiple times, inflating query results
-- and complicating permission revocation. The partial index allows the same
-- link to be re-created after soft delete.
UNIQUE INDEX (role_id, permission_id) WHERE deleted_at IS NULL
```

```
user_role (link table -- outside authz module)
──────────────────────────────
user_id         text FK -> user.id
role_id         text FK -> role.id

UNIQUE INDEX (user_id, role_id)
```

### 1.2 Key Differences from Medusa RBAC

| Medusa RBAC (`rbac_policy`) | Access Control (`permission`) |
|---|---|
| `key` (composite "resource:operation") | Dropped. `action` + `subject` are separate. |
| `resource` | `subject` (PascalCase, matches CASL convention) |
| `operation` | `action` (CASL convention) |
| No conditions | `conditions` jsonb (json-e templates) |
| No field-level | `fields` jsonb |
| No inverted | No inverted (by design) |

### 1.3 Condition Format (json-e)

Conditions are stored as json-e templates. At runtime, they are interpolated against a context object before being passed to CASL's `AbilityBuilder`.

**No conditions (80% case):**
```json
null
```

**Ownership condition:**
```json
{
  "author_id": { "$eval": "user.id" }
}
```

**Tenant condition (redundant with RLS, but useful for CASL's in-memory checks):**
```json
{
  "tenant_id": { "$eval": "user.tenant_id" }
}
```

**Status-based condition:**
```json
{
  "status": { "$in": ["draft", "review"] }
}
```
Note: static conditions (no interpolation needed) are stored as plain values. json-e passes through non-template values unchanged.

**Combined:**
```json
{
  "author_id": { "$eval": "user.id" },
  "status": { "$in": ["draft", "published"] }
}
```

### 1.4 Seeded Data

On module initialization, seed a super admin role:

```
Role:       { id: "role_super_admin", name: "Super Admin" }
Permission: { id: "perm_super_admin", action: "manage", subject: "all" }
Link:       { role_id: "role_super_admin", permission_id: "perm_super_admin" }
```

CASL treats `"manage"` as wildcard action and `"all"` as wildcard subject.

---

## 2. Ability Building

### 2.1 Fetching Permissions for a User

A user can have multiple roles. Permissions are resolved by collecting all
role_permission links for the user's roles -- a straightforward join, no
recursive CTEs needed.

```sql
SELECT DISTINCT p.*
FROM permission p
INNER JOIN role_permission rp ON rp.permission_id = p.id
INNER JOIN user_role ur ON ur.role_id = rp.role_id
WHERE ur.user_id = $1
  AND p.deleted_at IS NULL
  AND rp.deleted_at IS NULL
```

### 2.2 Caching

Cache resolved permissions per user (or per role set) in memory:
- Key: sorted role IDs hash
- TTL: configurable (Medusa uses 7 days)
- Invalidation: bust on role-permission or user-role changes

### 2.3 Interpolating Conditions with json-e

```typescript
import jsone from "json-e"

interface InterpolationContext {
  user: {
    id: string
    tenant_id: string
    [key: string]: unknown
  }
}

function interpolateConditions(
  conditions: Record<string, unknown> | null,
  context: InterpolationContext
): Record<string, unknown> | null {
  if (!conditions) return null
  return jsone(conditions, context)
}
```

Example:
```typescript
// DB row
{ action: "update", subject: "Product", conditions: { "author_id": { "$eval": "user.id" } } }

// After interpolation with context { user: { id: "usr_123" } }
{ action: "update", subject: "Product", conditions: { "author_id": "usr_123" } }
```

### 2.4 Building the CASL Ability

```typescript
import { AbilityBuilder, createMongoAbility, MongoAbility } from "@casl/ability"
import jsone from "json-e"

type Actions = "read" | "create" | "update" | "delete" | "manage"
type AppAbility = MongoAbility<[Actions, string]>

interface DBPermission {
  action: string
  subject: string
  conditions: Record<string, unknown> | null
  fields: string[] | null
}

function buildAbility(
  permissions: DBPermission[],
  context: InterpolationContext
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility)

  for (const perm of permissions) {
    const conditions = interpolateConditions(perm.conditions, context)

    if (perm.fields) {
      can(perm.action as Actions, perm.subject, perm.fields, conditions ?? undefined)
    } else {
      can(perm.action as Actions, perm.subject, conditions ?? undefined)
    }
  }

  return build()
}
```

---

## 3. Enforcement Layers

### 3.1 Layer Overview

```
Request
  |
  v
[1] Auth middleware          -- JWT -> user context (id, tenant_id, roles)
  |
  v
[2] Tenant middleware        -- set_config('app.tenant_id', ..., true) via withTenant()
  |
  v
[3] Ability middleware       -- fetch permissions, build CASL ability, attach to req
  |
  v
[4] Pre-request policy check -- route-declared policies, condition-free + user-context checks
  |
  v
[5] Route handler            -- entity-condition checks (ownership) after loading
  |
  v
[6] PostgreSQL + RLS         -- tenant boundary enforced unconditionally at DB level
```

### 3.2 Layer 1-3: Middleware Setup

```typescript
// Simplified middleware chain

// [1] Already exists: JWT verification, populates req.auth_context

// [2] Tenant context for RLS
async function tenantMiddleware(req, res, next) {
  // Wraps all downstream DB calls in a transaction with SET LOCAL
  req.tenantId = req.auth_context.tenant_id
  next()
}

// [3] Ability construction
async function abilityMiddleware(req, res, next) {
  const permissions = await fetchPermissionsForUser(req.auth_context.actor_id) // cached
  const ability = buildAbility(permissions, { user: req.auth_context })
  req.ability = ability
  next()
}
```

### 3.3 Layer 4: Pre-Request Policy Check

Similar to Medusa's `policies: [...]` middleware config, but using CASL:

```typescript
// Middleware config (route definition)
{
  method: ["POST"],
  matcher: "/admin/products/:id",
  middlewares: [...],
  policies: [{ action: "update", subject: "Product" }],
}

// Enforcement wrapper (like Medusa's wrapWithPoliciesCheck)
function wrapWithPolicyCheck(handler, policies) {
  return async (req, res, next) => {
    for (const policy of policies) {
      if (!req.ability.can(policy.action, policy.subject)) {
        throw new ForbiddenError(`Insufficient permissions: ${policy.action} ${policy.subject}`)
      }
    }
    return handler(req, res, next)
  }
}
```

This handles the 80% case: condition-free permissions. For permissions that have conditions based on user context only (e.g., `{ tenant_id: user.tenant_id }`), CASL evaluates them against the subject type string and they pass/fail based on whether any matching `can` rule exists for that action+subject.

### 3.4 Layer 5: In-Handler Entity Checks

For ownership and attribute-based conditions (the 20% case):

```typescript
import { subject } from "@casl/ability"
import { ForbiddenError } from "@casl/ability"

export const POST = async (req, res) => {
  const product = await query.graph({ entity: "product", filters: { id: req.params.id } })

  // CASL evaluates conditions against the actual entity
  ForbiddenError.from(req.ability).throwUnlessCan(
    "update",
    subject("Product", product)
  )

  // Proceed with mutation...
  await updateProductWorkflow(req.scope).run({ input: req.validatedBody })
}
```

For field-level permissions:
```typescript
import { permittedFieldsOf } from "@casl/ability/extra"

// Filter response to only permitted fields
const allowedFields = permittedFieldsOf(req.ability, "read", "Product")
const filteredProduct = pick(product, allowedFields)
```

### 3.5 Layer 6: PostgreSQL RLS

RLS policies defined in Drizzle schema:

```typescript
import { pgTable, pgPolicy, pgRole, uuid, text, sql } from "drizzle-orm/pg-core"

export const appUser = pgRole("app_user").existing()

const tenantPolicy = (table) =>
  pgPolicy("tenant_isolation", {
    as: "permissive",
    for: "all",
    to: appUser,
    using: sql`${table.tenantId} = current_setting('app.tenant_id', true)::uuid`,
    withCheck: sql`${table.tenantId} = current_setting('app.tenant_id', true)::uuid`,
  })

export const products = pgTable("products", {
  id: uuid("id").primaryKey(),
  tenantId: uuid("tenant_id").notNull(),
  authorId: uuid("author_id").notNull(),
  title: text("title"),
  // ...
}, (table) => [
  tenantPolicy(table),
  index("products_tenant_id_idx").on(table.tenantId),
])
```

Tenant context wrapper:
```typescript
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: typeof db) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT set_config('app.tenant_id', ${tenantId}, true)`
    )
    return fn(tx)
  })
}
```

---

## 4. List Query Scoping (Ownership Conditions)

### 4.1 Strategy

For list endpoints where the user can only see their own resources:

- **Tenant scoping**: Handled by RLS. No application code needed.
- **Ownership scoping**: Typed condition-to-where translators for known patterns.

### 4.2 Typed Condition Translators

Define a closed set of condition patterns as a TypeScript discriminated union. Each pattern has a corresponding Drizzle where-clause builder. The compiler enforces exhaustive handling.

```typescript
import { eq, inArray, and, SQL } from "drizzle-orm"
import { AnyPgColumn } from "drizzle-orm/pg-core"

// -- Condition pattern types (closed set) --

type EqCondition = {
  type: "eq"
  field: string
  value: string | number
}

type InCondition = {
  type: "in"
  field: string
  value: (string | number)[]
}

// Add new patterns here as the app grows.
// The exhaustive switch below will force you to add a translator.

type ConditionPattern = EqCondition | InCondition

// -- Parser: CASL condition -> typed patterns --

function parseConditions(
  conditions: Record<string, unknown>
): ConditionPattern[] {
  const patterns: ConditionPattern[] = []

  for (const [field, value] of Object.entries(conditions)) {
    if (typeof value === "string" || typeof value === "number") {
      patterns.push({ type: "eq", field, value })
    } else if (
      typeof value === "object" &&
      value !== null &&
      "$in" in value &&
      Array.isArray((value as any).$in)
    ) {
      patterns.push({ type: "in", field, value: (value as any).$in })
    } else {
      throw new Error(
        `Unknown condition pattern for field "${field}": ${JSON.stringify(value)}`
      )
    }
  }

  return patterns
}

// -- Translator: typed pattern -> Drizzle where clause --

function conditionToWhere(
  pattern: ConditionPattern,
  columnResolver: (field: string) => AnyPgColumn
): SQL {
  switch (pattern.type) {
    case "eq":
      return eq(columnResolver(pattern.field), pattern.value)
    case "in":
      return inArray(columnResolver(pattern.field), pattern.value)
    // TypeScript: if you add a new ConditionPattern variant,
    // the compiler errors here until you add a case.
    default:
      const _exhaustive: never = pattern
      throw new Error(`Unhandled condition pattern: ${(_exhaustive as any).type}`)
  }
}

// -- Composing for a list query --

function buildWhereFromAbility(
  ability: AppAbility,
  action: Actions,
  subjectType: string,
  columnResolver: (field: string) => AnyPgColumn
): SQL | undefined {
  const rules = ability.rulesFor(action, subjectType)
  const applicableRules = rules.filter((r) => !r.inverted && r.conditions)

  if (applicableRules.length === 0) {
    // No conditional rules -- either fully allowed or fully denied.
    // The pre-request middleware already checked ability.can(action, subject).
    return undefined
  }

  const whereClauses = applicableRules.flatMap((rule) => {
    const patterns = parseConditions(rule.conditions as Record<string, unknown>)
    return patterns.map((p) => conditionToWhere(p, columnResolver))
  })

  return and(...whereClauses)
}
```

Usage in a list endpoint:
```typescript
export const GET = async (req, res) => {
  const extraWhere = buildWhereFromAbility(
    req.ability,
    "read",
    "Product",
    (field) => {
      // Map condition field names to Drizzle table columns
      const columnMap: Record<string, AnyPgColumn> = {
        author_id: products.authorId,
        status: products.status,
      }
      const col = columnMap[field]
      if (!col) throw new Error(`Unknown filterable field: ${field}`)
      return col
    }
  )

  const results = await withTenant(req.tenantId, (tx) =>
    tx.select().from(products).where(extraWhere)
  )

  res.json({ products: results })
}
```

### 4.3 Why This Works

- **Tenant scoping**: RLS handles it. No condition needed in CASL or the translator.
- **Ownership**: `{ author_id: { "$eval": "user.id" } }` -> after json-e interpolation -> `{ author_id: "usr_123" }` -> parsed as `EqCondition` -> `eq(products.authorId, "usr_123")`.
- **Status-based**: `{ status: { "$in": ["draft", "review"] } }` -> static (no interpolation) -> parsed as `InCondition` -> `inArray(products.status, ["draft", "review"])`.
- **Type safety**: Adding a new condition pattern (e.g., `GteCondition` for date ranges) requires adding to the union AND adding a case to the switch. The compiler enforces this.
- **Throws on unknown patterns**: If someone stores a condition format the translator doesn't understand, it throws instead of silently ignoring it.

---

## 5. Architecture Diagram

```
                         REQUEST LIFECYCLE

  +-----------------------------------------------------------------+
  |  [1] Auth Middleware                                             |
  |      JWT -> { user_id, tenant_id, roles: [role_id, ...] }       |
  +-----------------------------------------------------------------+
                                |
                                v
  +-----------------------------------------------------------------+
  |  [2] Tenant Middleware                                           |
  |      req.tenantId = user.tenant_id                               |
  |      (withTenant wraps all downstream DB calls)                  |
  +-----------------------------------------------------------------+
                                |
                                v
  +-----------------------------------------------------------------+
  |  [3] Ability Middleware                                          |
  |      fetchPermissions(user_id)     <- cached by role set         |
  |        -> join user_role + role_permission + permission           |
  |        -> returns Permission[]                                   |
  |      interpolateConditions(perm.conditions, { user })            |
  |        -> json-e evaluation                                      |
  |      buildAbility(permissions, context)                          |
  |        -> CASL AbilityBuilder -> req.ability                     |
  +-----------------------------------------------------------------+
                                |
                                v
  +-----------------------------------------------------------------+
  |  [4] Pre-Request Policy Check (80% of checks)                   |
  |      Route declares: policies: [{ action, subject }]             |
  |      req.ability.can(action, subject)                            |
  |        -> condition-free: pass/fail immediately                  |
  |        -> 403 if denied                                          |
  +-----------------------------------------------------------------+
                                |
                                v
  +-----------------------------------------------------------------+
  |  [5] Route Handler                                               |
  |                                                                  |
  |  For mutations (20% of checks):                                  |
  |    entity = loadFromDB(id)                                       |
  |    ForbiddenError.from(req.ability)                               |
  |      .throwUnlessCan("update", subject("Product", entity))       |
  |                                                                  |
  |  For list queries:                                               |
  |    extraWhere = buildWhereFromAbility(ability, action, subject)   |
  |    results = withTenant(tenantId, tx =>                           |
  |      tx.select().from(table).where(and(filters, extraWhere))     |
  |    )                                                             |
  |                                                                  |
  |  For field-level:                                                |
  |    allowedFields = permittedFieldsOf(ability, "read", "Product") |
  |    response = pick(entity, allowedFields)                        |
  +-----------------------------------------------------------------+
                                |
                                v
  +-----------------------------------------------------------------+
  |  [6] PostgreSQL + RLS                                            |
  |      Every query filtered by:                                    |
  |        tenant_id = current_setting('app.tenant_id')              |
  |      Catches: forgotten WHEREs, SQL injection, direct DB access  |
  |      Unconditional. No application code can bypass it.           |
  +-----------------------------------------------------------------+
```

---

## 6. Module Structure (Medusa-Inspired)

```
packages/modules/access-control/
  src/
    index.ts                       -- Module(Modules.ACCESS_CONTROL, { service, loaders })
    models/
      index.ts                     -- barrel exports
      permission.ts                -- Permission entity
      role.ts                      -- Role entity
      role-permission.ts           -- RolePermission join entity
    services/
      index.ts
      access-control-module-service.ts -- extends MedusaService, implements IAccessControlModuleService
    repositories/
      index.ts
      access-control.ts              -- permission resolution queries
    loaders/
      initial-data.ts              -- seeds super admin role + manage:all permission
    types/
      index.ts
    migrations/
      Migration_initial.ts
  integration-tests/
    __tests__/
      access-control.spec.ts
```

### Service Interface

```typescript
interface IAccessControlModuleService extends IModuleService {
  // Permissions
  createPermissions(data: CreatePermissionDTO | CreatePermissionDTO[]): Promise<...>
  updatePermissions(data: UpdatePermissionDTO | UpdatePermissionDTO[]): Promise<...>
  deletePermissions(ids: string | string[]): Promise<void>
  listPermissions(filters?, config?): Promise<PermissionDTO[]>
  listAndCountPermissions(filters?, config?): Promise<[PermissionDTO[], number]>
  retrievePermission(id: string, config?): Promise<PermissionDTO>
  softDeletePermissions(...): Promise<...>
  restorePermissions(...): Promise<...>

  // Roles
  createRoles(data: CreateRoleDTO | CreateRoleDTO[]): Promise<...>
  updateRoles(data: UpdateRoleDTO | UpdateRoleDTO[]): Promise<...>
  deleteRoles(ids: string | string[]): Promise<void>
  listRoles(filters?, config?): Promise<RoleDTO[]>
  listAndCountRoles(filters?, config?): Promise<[RoleDTO[], number]>
  retrieveRole(id: string, config?): Promise<RoleDTO>
  softDeleteRoles(...): Promise<...>
  restoreRoles(...): Promise<...>

  // Role-Permission links
  createRolePermissions(data: CreateRolePermissionDTO | CreateRolePermissionDTO[]): Promise<...>
  deleteRolePermissions(ids: string | string[]): Promise<void>
  listRolePermissions(filters?, config?): Promise<RolePermissionDTO[]>

  // Custom: resolve all permissions for a set of role IDs
  listPermissionsForRoles(roleIds: string[]): Promise<Map<string, PermissionDTO[]>>
}
```

---

## 7. Admin API Surface

All routes gated by feature flag. Only super admin can manage roles/permissions.

### Permission Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/admin/access-control/permissions` | GET | List permissions |
| `/admin/access-control/permissions` | POST | Create permission |
| `/admin/access-control/permissions/:id` | GET | Get permission |
| `/admin/access-control/permissions/:id` | POST | Update permission |
| `/admin/access-control/permissions/:id` | DELETE | Delete permission |

### Role Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/admin/access-control/roles` | GET | List roles |
| `/admin/access-control/roles` | POST | Create role |
| `/admin/access-control/roles/:id` | GET | Get role |
| `/admin/access-control/roles/:id` | POST | Update role |
| `/admin/access-control/roles/:id` | DELETE | Delete role |
| `/admin/access-control/roles/:id/permissions` | GET | List role's permissions |
| `/admin/access-control/roles/:id/permissions` | POST | Add permissions to role |
| `/admin/access-control/roles/:id/permissions/:pid` | DELETE | Remove permission from role |
| `/admin/access-control/roles/:id/users` | GET | List role's users |
| `/admin/access-control/roles/:id/users` | POST | Assign users to role |
| `/admin/access-control/roles/:id/users` | DELETE | Remove users from role |

### User Routes

| Endpoint | Method | Purpose |
|---|---|---|
| `/admin/users/:id/roles` | GET | List user's roles |
| `/admin/users/:id/roles` | POST | Assign roles to user |
| `/admin/users/:id/roles` | DELETE | Remove roles from user |

### Me Route

| Endpoint | Method | Purpose |
|---|---|---|
| `/admin/access-control/me/permissions` | GET | Current user's effective permissions (resolved) |

---

## 8. Open Questions

1. **Permission registration from code**: Should the module auto-sync code-defined permissions to DB on startup (like Medusa's `syncRegisteredPolicies`)? This is useful for ensuring route-declared policies always have corresponding DB records, but adds complexity.

2. **Condition validation on permission creation**: Should the admin API validate that conditions are valid json-e templates on write? (Probably yes -- fail on write, not on request.)

3. **Field-level permission granularity**: Should `fields` on the permission be per-subject or per-action+subject? E.g., can a user have `read` access to `["title", "price"]` but `update` access to only `["title"]`? (CASL supports this natively -- each `can()` call can have its own fields.)

4. **Condition-to-where column mapping**: Where does the mapping from condition field names to Drizzle table columns live? Options:
   - Co-located with the table schema definition
   - In a central registry
   - In each route handler (current sketch)

5. **RLS + Drizzle version**: The full RLS support requires `drizzle-orm@0.36.0+`. Need to confirm the prototype's Drizzle version.
