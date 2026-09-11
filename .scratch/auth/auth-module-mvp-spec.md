# Auth Module MVP Spec

## Problem Statement

The platform has no authentication system. Users, API routes, and the admin dashboard are unprotected. There is no way to register an account, log in, verify email ownership, reset a password, or accept an invite. The existing user module stores user records but has no concept of credentials or identity. Without auth, the planned access control (RBAC/ABAC) module has no `actor_id` to resolve permissions against, and the platform cannot be deployed to real users.

## Solution

Build an auth module that provides pluggable, provider-based authentication with JWT-based access control. The module handles identity management, credential verification, email verification, and password reset. JWT is the sole authentication mechanism — every authenticated request carries a bearer token in the `Authorization` header. The architecture mirrors the payment module's provider pattern (ADR 0010, ADR 0011) to allow future addition of OAuth providers, API key auth, MFA, and other auth methods without restructuring.

The MVP ships with one auth provider (emailpass), one verification provider (token-based), and bearer middleware for all protected routes. Admin users are invite-only (like Medusa). Customers have self-signup.

## User Stories

1. As an unauthenticated customer, I want to register with an email and password, so that I can create an account on the storefront. (Admin users are invite-only.)
2. As a registered user, I want to log in with my email and password, so that I can access protected resources.
3. As a logged-in user, I want to log out by discarding my token on the client, so that I can end my session.
4. As a newly registered user, I want to receive a verification email with a code, so that I can prove I own the email address I registered with.
5. As a user who received a verification email, I want to submit the code to confirm my email, so that I can complete the verification requirement and get full access.
6. As a user who has forgotten my password, I want to request a password reset link, so that I can regain access to my account.
7. As a user who received a password reset email, I want to submit a new password using the link, so that my credentials are updated and I can log in again.
8. As an admin, I want to invite a new user by email, so that they can join the platform with a pre-assigned role.
9. As an invited user, I want to register my credentials and accept the invite in a defined sequence, so that my account is created and linked to the correct identity.
10. As a user whose email is unverified, I want the login endpoint to tell me verification is required (rather than silently failing), so that I know what step to take next.
11. As a user who requests verification multiple times, I want only the latest code to be valid, so that old codes cannot be reused.
12. As a user who requests a password reset multiple times, I want only the latest reset link to be valid, so that old links cannot be reused.
13. As an attacker who guesses a random email, I want the password reset endpoint to always return 201 regardless of whether the email exists, so that I cannot enumerate registered accounts.
14. As a platform operator, I want to configure which auth providers are allowed per actor type, so that I can restrict authentication methods.
15. As a platform operator, I want to configure which actor types require email verification, so that I can enforce verification for some user types but not others.
16. As a platform operator, I want to add a new auth provider (e.g., Google OAuth) in the future without modifying the auth module's core, so that the system is extensible.
17. As a platform operator, I want to add a new verification provider (e.g., SMS) in the future without modifying the auth module's core, so that verification methods are extensible.
18. As the access control middleware (future), I want `req.auth_context.actor_id` to be populated on every authenticated request, so that I can resolve permissions for the current user.
19. As a developer, I want the auth module to follow the same module pattern as payment and user (models, repositories, services, loaders, index), so that the codebase stays consistent.
20. As a developer, I want password hashes to never appear in API responses or JWT payloads, so that credentials cannot leak.
21. As a developer, I want verification tokens and password reset tokens to be stored as SHA-256 hashes (never plaintext), so that a database breach does not expose active tokens.
22. As a developer, I want the auth service to return plaintext tokens to the route handler (not leak them in API responses), so that a workflow can forward them to the notification module for email delivery.

## Dependencies

```bash
pnpm --filter backend add jsonwebtoken scrypt-kdf
pnpm --filter backend add -D @types/jsonwebtoken
```

| Package | Version | Purpose |
|---------|---------|---------|
| `jsonwebtoken` | ^9 | JWT signing (`jwt.sign`) and verification (`jwt.verify`) |
| `@types/jsonwebtoken` | ^9 | TypeScript types (dev only) |
| `scrypt-kdf` | ^2 | Password hashing and verification in the emailpass provider |

Everything else uses Node.js built-ins (no extra dependencies):
- `crypto.createHash("sha256")` — one-way hashing of verification tokens and reset token JTIs
- `crypto.randomBytes(32)` — cryptographically secure verification token generation
- `crypto.randomUUID()` — reset token JTI generation

## Implementation Decisions

### Data Models

Four tables, following existing conventions (SQL-prefixed IDs per ADR 0003, soft-delete per ADR 0006, shared `timestamps` helper):

> Medusa source: `packages/modules/auth/src/models/auth-identity.ts`, `provider-identity.ts`, `auth-verification.ts`, `auth-password-reset-token.ts`

**auth_identity** — Top-level identity record. One per person. Owns all downstream auth data via cascade deletes.
- `id` (prefixed `authid_`)
- `app_metadata` (jsonb, nullable) — Stores actor linkage, e.g., `{ user_id: "usr_..." }`
- `timestamps` (createdAt, updatedAt, deletedAt)

**provider_identity** — Links an auth identity to a specific auth provider. One per provider per identity.
- `id` (prefixed `provid_`)
- `auth_identity_id` (FK to auth_identity)
- `entity_id` (text) — The provider-specific identifier (email address for emailpass)
- `provider` (text) — Provider key, e.g., `"emailpass"`
- `provider_metadata` (jsonb, nullable) — Provider-specific data (password hash for emailpass)
- `user_metadata` (jsonb, nullable)
- `timestamps`
- Unique index on `(entity_id, provider)` where `deleted_at IS NULL` — prevents two identities from registering the same email with the same provider

**auth_verification** — Tracks entity verification status. One record per identity + entity combination.
- `id` (prefixed `authver_`)
- `auth_identity_id` (FK to auth_identity)
- `entity_id` (text) — The value being verified (email address)
- `entity_type` (text) — The kind of entity (e.g., `"email"`)
- `code_provider` (text) — Which verification provider generated the code (e.g., `"token"`)
- `verified_at` (datetime, nullable) — Null means unverified
- `requested_at` (datetime) — Timestamp of last token generation, used for expiry computation
- `provider_metadata` (jsonb, nullable) — Stores `{ token_hash }` for the token provider
- `timestamps`
- Unique index on `(auth_identity_id, entity_id, entity_type)` where `deleted_at IS NULL` — ensures one verification record per identity + entity pair, so re-requesting rotates the existing token instead of creating duplicates

**auth_password_reset_token** — Single-use password reset tokens. Hard-deleted on consumption.
- `id` (prefixed `authprt_`)
- `auth_identity_id` (FK to auth_identity)
- `provider_identity_id` (FK to provider_identity)
- `entity_id` (text) — Denormalized copy of the entity ID
- `token_hash` (text) — SHA-256 hex digest of the raw JTI (never store plaintext)
- `expires_at` (datetime) — Hard expiry
- `created_at`, `updated_at` — No `deleted_at`; this table uses hard-delete, not soft-delete. Transient security tokens have no reason to be retained after consumption.
- Index on `provider_identity_id` — fast invalidation of prior reset tokens when a new reset is requested for the same provider identity
- Index on `token_hash` — fast lookup during `consumePasswordResetToken` (hash-based token consumption)
- **Custom repository** — does not extend BaseRepository. BaseRepository auto-filters `WHERE deleted_at IS NULL` on every query, which would error on a table without that column. Instead, write a narrow custom repository with only the methods needed: `create`, `findByTokenHash`, `deleteByProviderIdentityId`, `hardDelete`. This avoids scope creep (no `softDelete: false` flag on BaseRepository) and matches the table's narrow access patterns.

### Service Architecture

Follows the two-container pattern (ADR 0001). Only `AuthModuleService` is exposed to the shared container.

**AuthModuleService** — Main orchestrator. Public API surface:
> Medusa source: `packages/modules/auth/src/services/auth-module.ts`
- `register(provider, authData)` — Delegates to auth provider, returns auth identity
- `authenticate(provider, authData)` — Delegates to auth provider, returns auth identity
- `updateProvider(provider, data)` — Delegates to auth provider for credential updates (password reset completion)
- `createPasswordResetToken({ provider, entity_id, ttl_seconds })` — Generates UUID jti, SHA-256 hashes it, invalidates prior tokens, persists record
- `consumePasswordResetToken({ jti, provider, entity_id })` — Hash-based lookup, expiry check, provider cross-check, atomic deletion (single-use enforcement)
- `requestAuthVerification(data)` — Delegates to verification provider
- `confirmAuthVerification(data)` — Delegates to verification provider
- `validateAuthIdentity(id, provider)` — Retrieves auth identity by ID and returns an `AuthenticationResponse`. Used by the token refresh flow (Branch 2: actorless tokens) to re-check auth state before re-running verification gates. In Medusa this also applies MFA requirements; for MVP (no MFA) it's a thin wrapper around `authIdentityService_.retrieve` that normalizes the return shape.
- `retrieveAuthIdentity(id)` — For the setAuthAppMetadata step
- `updateAuthIdentities(data)` — For the setAuthAppMetadata step

**AuthProviderService** — Routes auth operations to the correct provider via `au_` prefix. Resolves `au_{providerId}` from the local container. Methods: `register`, `authenticate`, `update`.
> Medusa source: `packages/modules/auth/src/services/auth-provider.ts`

**VerificationProviderService** — Routes verification operations to the correct provider via `verif_` prefix. Resolves `verif_{providerId}` from the local container. Methods: `request`, `confirm`.
> Medusa source: `packages/modules/auth/src/services/verification-provider.ts`

**AuthIdentityProviderService** — Not a DI-registered service. A plain object created per-call by `AuthModuleService.getAuthIdentityProviderService(provider)` and passed into provider methods as an argument.
> Medusa source: `packages/modules/auth/src/services/auth-module.ts` (see `getAuthIdentityProviderService` method)

Created fresh on every `authenticate()`, `register()`, `validateCallback()`, and `updateProvider()` call. Each instance closes over a specific `provider` string, scoping all operations to that provider.

Why an inline object instead of a DI service:
- **Per-call scoping** — the `provider` parameter changes with every call. DI services are registered once with fixed scope. A DI factory would be more ceremony for the same result.
- **Intentional API boundary** — this proxy is the *only* way auth providers touch the database. Providers never see internal services (`authIdentityService_`, `providerIdentityService_`, `baseRepository_`). This is what makes auth providers extractable to standalone packages — they depend on the proxy interface, not module internals.

Methods:
- `retrieve({ entity_id })` — Find identity by entity_id + provider
- `create({ entity_id, provider_metadata, user_metadata })` — Create identity + provider identity
- `update(entity_id, { provider_metadata })` — Update provider identity for the scoped provider

### Provider Registration

Follows ADR 0011 (module loaders). The auth module loader registers providers in the local DI container:

- Built-in emailpass provider registered as `au_emailpass`
- Built-in token verification provider registered as `verif_token`
- Custom providers registered from `options.providers` array (auth) and `options.verification.providers` array (verification)

Provider config shape mirrors the payment module. Note: `AuthModuleOptions` contains only provider registration config. JWT config (`JWT_SECRET`, `JWT_EXPIRES_IN`) lives in environment variables (validated by Zod at startup), not here. Scrypt config is passed via the emailpass provider's `options` field. Token verification TTL is passed via the token provider's `options` field.

> Medusa source: `packages/modules/auth/src/types/index.ts`

```typescript
type AuthModuleOptions = Partial<ModuleServiceInitializeOptions> & {
  providers?: {                          // auth providers (emailpass, google, etc.)
    resolve: string | ModuleProviderExports
    id: string                           // e.g., "emailpass"
    options?: Record<string, unknown>    // provider-specific config (e.g., scrypt params)
  }[]
  verification?: {                       // verification providers
    providers?: {
      resolve?: string | ModuleProviderExports
      id: string                         // e.g., "token"
      options?: Record<string, unknown>  // e.g., { ttl_seconds: 900 }
    }[]
  }
}
```

Provider-specific options are passed through to the provider constructor, not interpreted by the auth module itself:
- **emailpass provider options**: `{ hashConfig: { logN: 15, r: 8, p: 1 } }` — scrypt parameters
- **token verification provider options**: `{ ttl_seconds: 900 }` — verification code expiry

### Provider Interfaces

Two distinct provider interfaces, reflecting different DB access patterns:

**`AbstractAuthModuleProvider`** — Base class for auth providers (emailpass, future OAuth, etc.). Auth providers never access the database directly.
> Medusa source: `packages/core/utils/src/auth/abstract-auth-provider.ts`

They receive an `AuthIdentityProviderService` proxy at call time with scoped `retrieve`, `create`, `update` methods. Constructor receives only generic dependencies (e.g., `{ logger }`). This makes auth providers extractable into standalone packages.

```typescript
abstract class AbstractAuthModuleProvider implements IAuthProvider {
  static identifier: string
  static DISPLAY_NAME: string
  static validateOptions(options: Record<any, any>): void | never {}

  authenticate(data: AuthenticationInput, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthenticationResponse>
  register(data: AuthenticationInput, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthenticationResponse>
  validateCallback(data: AuthenticationInput, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthenticationResponse>
  update(data: Record<string, unknown>, authIdentityProviderService: AuthIdentityProviderService): Promise<AuthenticationResponse>
}
```

**`IAuthVerificationProvider`** — Interface for verification providers (token-based, future SMS, etc.). Verification providers need direct transactional access
> Medusa source: `packages/core/types/src/auth/verification-provider.ts`

Verification providers need direct transactional access to the auth module's internal DB services (e.g., `authVerificationService`). They receive `sharedContext` for transaction participation. This requires them to live inside the auth module.

```typescript
interface IAuthVerificationProvider {
  readonly identifier: string
  request(data: RequestAuthVerificationDTO, sharedContext?: Context): Promise<RequestAuthVerificationResponse>
  confirm(data: ConfirmAuthVerificationDTO, sharedContext?: Context): Promise<ConfirmAuthVerificationResponse>
}
```

**Why the split:** Auth providers interact with identity data through a controlled proxy — they don't need the module's private services. Verification providers need direct access to `authVerificationService` (an internal `IMedusaInternalService` auto-registered by `MedusaService`) to read/write `auth_verification` rows within the caller's transaction. This is why auth providers can be external packages while verification providers must live inside the module.

### Built-in Providers

**emailpass auth provider** (`au_emailpass`) — Extends `AbstractAuthModuleProvider`. Lives inside the auth module for the MVP
> Medusa source: `packages/modules/providers/auth-emailpass/src/services/emailpass.ts`

Lives inside the auth module for the MVP (extractable to a standalone package later since it only uses the `AuthIdentityProviderService` proxy). Constructor: `{ logger }`. Configured via provider `options`.

- `register` — Validates email + password, checks for existing identity (supports claimable identities with empty `app_metadata`), hashes password with scrypt, creates or updates via `AuthIdentityProviderService`
- `authenticate` — Validates email + password, retrieves identity, verifies password hash with scrypt constant-time comparison
- `update` — Hashes new password, merges into existing `provider_metadata`
- All methods strip `provider_metadata.password` from returned DTOs before returning (sanitization)
- Scrypt config defaults: `{ logN: 15, r: 8, p: 1 }`, configurable via provider options

**token verification provider** (`verif_token`) — Implements `IAuthVerificationProvider`. Lives inside the auth module (must — needs `authVerificationService` injected).
> Medusa source: `packages/modules/auth/src/providers/verification/token.ts`

Constructor: `{ authVerificationService }`. Configured via provider `options`.

- `request` — Generates 32-byte random token (`crypto.randomBytes`), SHA-256 hashes it, upserts `auth_verification` record (create if new, update if re-requested — rotates token, invalidates prior codes). Returns record + plaintext `code` + `expires_at` (plaintext returned to the route handler for forwarding to notification module, never in API response)
- `confirm` — SHA-256 hashes submitted code, looks up by hash, validates not-already-verified, validates code_provider match, validates expiry (`requested_at + TTL`), stamps `verified_at`
- TTL default: 900 seconds (15 minutes), configurable

### Cryptographic Operations

Two algorithms, both from Node.js built-ins:
- **scrypt** (via `scrypt-kdf` library) — Password hashing. Config: `logN`, `r`, `p`. Used by emailpass provider for register, authenticate, and update.
- **SHA-256** (via `crypto.createHash`) — Token hashing. Used for verification tokens and password reset token JTIs. One-way; only the hash is stored.

### JWT Implementation

JWT is the sole authentication mechanism for all API access. The `jsonwebtoken` library handles signing and verification. There are exactly two callsites: one `sign()` wrapper and one `verify()` callsite.

#### Configuration

JWT config comes from environment variables, validated by Zod at startup in `env.ts`:

```typescript
// In env.ts (extends existing schema):
const envSchema = z.object({
  // ... existing vars (POOLER_DATABASE_URL, STRIPE_SECRET_KEY, etc.)
  JWT_SECRET: z.string(),                          // Required. Used for signing and symmetric verification.
  JWT_PUBLIC_KEY: z.string().default(''),           // Optional. For asymmetric (RS256) verification.
  JWT_EXPIRES_IN: z.string().default('1d'),         // Controls how long tokens are valid.
})
```

Startup fails with a descriptive Zod error if `JWT_SECRET` is missing — no silent fallback to a dev default.

#### Sign Wrapper (`generateJwtToken`)

> Medusa source: `packages/core/utils/src/auth/token.ts`

A single utility function wraps all `jwt.sign()` calls in the system:

```typescript
const generateJwtToken = (
  tokenPayload: Record<string, unknown>,
  jwtConfig: {
    secret?: Secret
    expiresIn?: number | string
    jwtOptions?: SignOptions
  }
) => {
  // Throws if secret or expiresIn is missing
  const expiresIn = jwtConfig.expiresIn ?? jwtConfig.jwtOptions?.expiresIn
  return jwt.sign(tokenPayload, jwtConfig.secret, {
    ...jwtConfig.jwtOptions,   // spread first (algorithm, issuer, etc.)
    expiresIn,                 // override — direct param wins over jwtOptions.expiresIn
  })
}
```

This is the only place `jwt.sign()` is called for auth and reset tokens. The User Module also calls it for invite tokens (with its own secret).

#### Verify Callsite (`getAuthContextFromJwtToken`)

> Medusa source: `packages/core/framework/src/http/middlewares/authenticate-middleware.ts`

A single function wraps all `jwt.verify()` calls for bearer token validation:

```typescript
const getAuthContextFromJwtToken = (
  authHeader: string | undefined,
  actorTypes: (ActorType | "*")[],
): AuthContext | null => {
  // 1. Regex-match "Bearer <token>" from Authorization header
  // 2. Resolve secret: env.JWT_PUBLIC_KEY || env.JWT_SECRET
  // 3. Build verify options:
  //    - Force ignoreExpiration = false as OWN PROPERTY (prototype pollution defense)
  //    - Force ignoreNotBefore = false as OWN PROPERTY
  // 4. Call verify(token, secret, options)
  // 5. Check verified.actor_type is in permitted actorTypes
  // 6. Return null on any exception (caller handles 401)
}
```

The prototype pollution defense is critical: `jsonwebtoken` reads `ignoreExpiration` from the options prototype chain, so a polluted `Object.prototype.ignoreExpiration = true` would silently disable expiry checks. Setting them as own properties with `hasOwnProperty` guard prevents this.

When `JWT_PUBLIC_KEY` is set, it is used for verification while `JWT_SECRET` is used for signing. This enables asymmetric setups (RS256) where the signing key and verification key are separated.

#### Three JWT Types

**Actorless JWT** — Issued during registration and when verification/MFA blocks a full token.

Payload:
```typescript
{
  actor_id: "",                          // empty string — cannot access protected routes
  actor_type: "user",                    // from URL param
  auth_identity_id: "authid_...",        // from auth module
  auth_provider: "emailpass",            // from URL param
  app_metadata: {
    ...authIdentity.app_metadata,
    user_id: undefined,                  // explicitly undefined (no linked actor)
  },
  user_metadata: providerIdentity?.user_metadata ?? {},
}
```

Signed with: `{ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN }`

**Full JWT** — Issued from login (when no blockers) and token refresh. Identical structure but with `actor_id` populated:

Payload:
```typescript
{
  actor_id: "usr_abc123",                // from authIdentity.app_metadata[`${actorType}_id`]
  actor_type: "user",
  auth_identity_id: "authid_...",
  auth_provider: "emailpass",
  app_metadata: {
    ...authIdentity.app_metadata,
    user_id: "usr_abc123",
    // TODO(access-control): embed roles[] here when access-control module lands
  },
  user_metadata: providerIdentity?.user_metadata ?? {},
}
```

Signed with: same config as actorless.

**Reset JWT** — Purpose-bound, single-use token for password reset. Completely different payload shape:

Payload:
```typescript
{
  entity_id: "user@example.com",         // the email, NOT actor_id
  provider: "emailpass",                 // NOT auth_provider (different key name)
  actor_type: "user",
  purpose: "reset",                      // discriminating claim
}
```

Signed with:
```typescript
// Security-sensitive: short-lived by design, decoupled from regular token lifetime.
const RESET_PASSWORD_TOKEN_TTL_SECONDS = 15 * 60

{
  secret: env.JWT_SECRET,
  expiresIn: `${RESET_PASSWORD_TOKEN_TTL_SECONDS}s`,
  jwtid: resetToken.jti,                 // UUID linking to DB record (single-use fingerprint)
}
```

The `purpose: "reset"` claim and `jti` claim together enforce that: (1) regular actorless JWTs are rejected at the password update endpoint, and (2) the token can only be used once (the DB row is atomically deleted on consumption).

#### Token Generation and Gating (`generateJwtTokenWithChecks`)

> Medusa source: `packages/medusa/src/api/auth/utils/generate-jwt-token.ts`

Login and token refresh use a gating function that controls which token type is returned:

```
generateJwtTokenWithChecks(container, { authIdentity, actorType, authProvider })
  |
  +-- 1. Always generate actorless token first (skipActorType: true)
  |
  +-- 2. Check verification via validateVerification() (Medusa source: packages/medusa/src/api/auth/utils/validate-verification.ts):
  |      - Reads authVerificationsPerActor[actorType] from config
  |      - If config entry exists for this auth_provider:
  |        - Finds provider_identity matching auth_provider
  |        - Queries auth_verification by (auth_identity_id, entity_id, entity_type)
  |        - If no record or verified_at is null:
  |          -> return { verification_required: true, verification, token: actorlessToken }
  |
  +-- 3. No blockers -- generate full token (skipActorType: false)
         -> return { token: fullToken }
```

**Who calls what:**
- `generateJwtTokenWithChecks` — Login endpoint, OAuth callback, token refresh (when `actor_id` is absent)
- `generateJwtTokenForAuthIdentity` directly — Registration (always actorless), token refresh (when `actor_id` is present, just re-sign with fresh data)

#### Token Refresh Route (`POST /auth/token/refresh`)

> Medusa source: `packages/medusa/src/api/auth/token/refresh/route.ts`

Two branches based on whether the current token already has an `actor_id`:

**Branch 1: `actor_id` is set** (already a full token) — Simple re-sign. Retrieves fresh `AuthIdentity` from DB (including `provider_identities`), calls `generateJwtTokenForAuthIdentity` directly. This picks up any changes to `app_metadata` (e.g., new roles). Returns `{ token }`.

**Branch 2: `actor_id` is absent** (actorless token) — Runs `service.validateAuthIdentity(auth_identity_id, auth_provider)` which re-checks auth state, then calls `generateJwtTokenWithChecks` which re-runs verification/MFA gates. If gates still block, the gated result (`verification_required` or `mfa_required`) is returned as-is. If gates pass (e.g., user just verified their email), a full token is returned.

This is the critical endpoint for the post-invite-accept flow: after `setAuthAppMetadataStep` writes `user_id` into `app_metadata`, token refresh picks it up and returns a full JWT with `actor_id` populated.

#### Reset Token Validation Middleware (`validateToken`)

> Medusa source: `packages/medusa/src/api/auth/utils/validate-token.ts`

Used only on `POST /auth/:actor_type/:auth_provider/update` (password reset completion):

```
validateToken()
  |
  +-- 1. Extract JWT from Authorization header via getAuthContextFromJwtToken()
  |      (reuses the same verify logic as the authenticate middleware)
  |
  +-- 2. Guard: token.purpose !== "reset" || !token.jti -> reject
  |      (prevents regular actorless JWTs from being used here)
  |
  +-- 3. authModule.consumePasswordResetToken({ jti, provider, entity_id })
  |      - Hash-based lookup of jti in auth_password_reset_token table
  |      - Cross-checks provider and entity_id match the DB record
  |      - Checks expiry
  |      - Atomically deletes the row (single-use enforcement)
  |      - Throws on any mismatch -> middleware returns "Invalid token"
  |
  +-- 4. Fetch provider_identity for the entity_id + auth_provider
  |
  +-- 5. Populate req.auth_context with:
         { actor_type, auth_identity_id, actor_id: entity_id,
           app_metadata: {}, user_metadata: providerIdentity.user_metadata }
         (entity_id comes from the validated token, not from request body)
```

### Authentication Middleware

> Medusa source: `packages/core/framework/src/http/middlewares/authenticate-middleware.ts`
> AuthContext type: `packages/core/framework/src/http/types.ts`

#### Middleware Architecture

The framework uses a hybrid approach:

1. **Declarative schemas** — Zod schemas for params/query/body/response validation. These are data objects, introspectable for OpenAPI generation. This is the existing system; it does not change.
2. **Imperative middleware chain** — An optional `middlewares[]` array on `MiddlewareRoute` for pre-handler logic that needs to mutate `req` (auth, request enrichment). Runs in order, before validation, before handler.

Post-handler middleware is out of scope. Response validation stays as the existing `responseSchema` Zod parse.

```typescript
// Updated MiddlewareRoute type — adds optional middlewares array
type MiddlewareRoute = (GetRoute | BodyRoute | DeleteRoute) & {
  middlewares?: MiddlewareFunction[]  // pre-handler, runs in order before validation
}

type MiddlewareFunction = (req: HttpRequest) => HttpRequest | Promise<HttpRequest>
// Returns a modified req (immutable pattern, no mutation).
// Throw AppError to short-circuit (e.g., 401).
```

Updated `HttpRequest` type — adds `auth_context`:

```typescript
type HttpRequest<T = object> = {
  params: ...
  query: ...
  validatedQuery: ...
  body: ...
  scope: AwilixContainer
  headers: Record<string, string>
  auth_context?: AuthContext          // populated by auth middleware, absent on public routes
}
```

The `routes-loader.ts` execution order becomes:

```
1. Namespace auth (implicit, based on directory)
2. middlewares[] from MiddlewareRoute config (explicit overrides)
3. Declarative validation (params, query/body schemas)
4. Route handler
5. Response schema validation
```

**Change to `apply-middleware.ts`**: The current `applyMiddleware` reassigns `req` via spread (`req = { ...req, validatedQuery: ... }`), which is compatible with the immutable return pattern. To support `middlewares[]`, thread the request through each middleware before proceeding to validation:

```typescript
// In applyMiddleware, before param/query/body validation:
if (config.middlewares?.length) {
  for (const mw of config.middlewares) {
    req = await mw(req)
  }
}
```

#### `authenticate` Factory

A factory function that returns a `MiddlewareFunction`. Supports bearer JWT as the sole auth strategy for MVP.

```typescript
authenticate(
  actorType: ActorType | ActorType[] | "*",  // union type, or "*" for any
  options?: {
    allowUnauthenticated?: boolean      // permit requests with no auth at all
    allowUnregistered?: boolean          // Permits actorless JWTs (auth_identity exists, actor_id is empty).
                                         // Name is misleading — the user IS registered (has an auth identity),
                                         // they just don't have a linked actor entity yet. Think of it as
                                         // "allowActorless". Kept as "allowUnregistered" to match Medusa naming.
                                         // Used for post-registration flows: token refresh after invite accept,
                                         // verification request/confirm.
  }
): MiddlewareFunction
```

Resolution:

```
1. Read Authorization: Bearer <token> from req.headers
2. Call jwt.verify() with prototype pollution defenses
3. Validate actor_type from JWT payload against permitted actorTypes
4. Return enriched req with auth_context, or throw 401
```

Decision tree:

```
authContext.actor_id is set?
  -> YES: return { ...req, auth_context: authContext }  (fully authenticated)

authContext.auth_identity_id is set AND allowUnregistered?
  -> YES: return { ...req, auth_context: authContext }  (actorless — invite/registration flow)

allowUnauthenticated?
  -> YES: return req  (public endpoint, no auth_context set)

Otherwise:
  -> throw AppError 401 "Unauthorized"
```

#### Namespace Defaults

The `routes-loader.ts` infers auth from the directory — no config needed for standard routes:

| Namespace | Actor Type | Auth Type | Behavior |
|-----------|-----------|-----------|----------|
| `/admin/**` | `"user"` | `"bearer"` | **Authenticated by default.** Every admin route gets `auth_context: AuthContext` (non-optional). |
| `/store/**` | `"customer"` | `"bearer"` | `allowUnauthenticated: true`. Auth context is optional — present if token provided. |
| `/auth/**` | — | — | **No global auth.** Each route opts in via `middlewares[]` in its middleware config. |

Standard admin route — no auth config needed:

```typescript
// api/admin/products/route.ts
export const GET = async (req: HttpRequest<ListProductsInput>): Promise<HttpResult<...>> => {
  // req.auth_context is guaranteed by namespace default (non-optional for /admin/**)
  const userId = req.auth_context.actor_id
}
```

#### Per-Route Overrides

Routes that need different auth use `middlewares[]` in their middleware config:

```typescript
// api/admin/invites/middlewares.ts
{
  method: 'POST',
  matcher: '/admin/invites/accept',
  middlewares: [
    authenticate("user", { allowUnregistered: true }),  // override: allow actorless JWTs
  ],
  bodySchema: AdminInviteAccept,
  responseSchema: AdminAcceptInviteResponse,
}
```

When `middlewares[]` includes an `authenticate()` call, it **replaces** the namespace default for that route — the loader does not double-run auth.

#### Auth Route Middleware Map

> Medusa source: `packages/medusa/src/api/auth/middlewares.ts`

Since `/auth/**` has no global auth, each route explicitly declares its requirements via `middlewares[]`:

| Route | Method | `middlewares[]` |
|-------|--------|-----------------|
| `/auth/token/refresh` | POST | `authenticate("*", { allowUnregistered: true })` |
| `/auth/verification/request` | POST | `authenticate("*", { allowUnregistered: true })` |
| `/auth/verification/confirm` | POST | `authenticate("*", { allowUnregistered: true, allowUnauthenticated: true })` |
| `/auth/:actor_type/:auth_provider` | POST, GET | `validateScopeProviderAssociation()` |
| `/auth/:actor_type/:auth_provider/register` | POST | `validateScopeProviderAssociation()` |
| `/auth/:actor_type/:auth_provider/reset-password` | POST | `validateScopeProviderAssociation()` |
| `/auth/:actor_type/:auth_provider/update` | POST | `validateScopeProviderAssociation()`, `validateToken()` |

`validateScopeProviderAssociation` (Medusa source: `packages/medusa/src/api/auth/utils/validate-scope-provider-association.ts`) — Reads `req.params.actor_type` and `req.params.auth_provider`, checks `authMethodsPerActor[actor_type]` from auth config. If the config key exists and does not include `auth_provider`, throws `NOT_ALLOWED`. If the config key is absent, all providers are allowed.

### End-to-End Auth Data Flow

**Login:**
```
Client -> POST /auth/user/emailpass { email, password }
  -> (no auth middleware -- public route)
  -> validateScopeProviderAssociation() checks provider allowed
  -> authModule.authenticate("emailpass", { email, password })
  -> generateJwtTokenWithChecks():
      -> generates actorless token
      -> checks verification config -> not required (or verified)
      -> generates full token with actor_id from app_metadata
  -> Response: { token: "<full-jwt>" }
```

**Authenticated requests (all subsequent):**
```
Client -> GET /admin/products
         Authorization: Bearer <full-jwt>
  -> authenticate("user", "bearer")
  -> getAuthContextFromJwtToken() verifies JWT, extracts AuthContext
  -> actor_type "user" matches permitted types
  -> req.auth_context = { actor_id: "usr_...", actor_type: "user", ... }
  -> Route handler executes with full auth context
```

**Logout:**
```
Client discards the JWT from local storage.
No server-side action required -- the token expires naturally per JWT_EXPIRES_IN.
```

### API Routes

Seven routes across two concerns (auth ceremony and token management):

**Registration and Login:**
- `POST /auth/:actor_type/:auth_provider/register` — Public. Creates auth identity + provider identity, returns actorless JWT.
- `POST /auth/:actor_type/:auth_provider` (authenticate) — Public. Verifies credentials, returns full JWT or `{ verification_required }` or actorless JWT depending on state.

**Token Refresh:**
- `POST /auth/token/refresh` — Bearer auth (actorless or full). Re-signs JWT with fresh `app_metadata`. Used after invite accept to get `actor_id` populated.

**Email Verification:**
- `POST /auth/verification/request` — Bearer auth (actorless). Generates verification token, forwards plaintext code to notification module via workflow (TODO: notification module not built yet), returns record without code.
- `POST /auth/verification/confirm` — Public or bearer auth. Submits code, marks entity as verified.

**Password Reset:**
- `POST /auth/:actor_type/:auth_provider/reset-password` — Public. Generates reset token, forwards signed reset JWT to notification module via workflow (TODO: notification module not built yet). Always returns 201 (no information leak).
- `POST /auth/:actor_type/:auth_provider/update` — Bearer auth (reset JWT only). `validateToken` middleware consumes the DB token (single-use), then emailpass provider hashes the new password.

### Request Flows

**Invite-based signup (3 HTTP calls):**
1. `POST /auth/user/emailpass/register` — Returns actorless JWT
2. `POST /admin/invites/accept` (bearer: actorless JWT) — Runs `acceptInviteWorkflow`: validates invite token, creates user, links auth identity via `setAuthAppMetadataStep`, deletes invite
3. `POST /auth/token/refresh` (bearer: actorless JWT) — Returns full JWT with `actor_id` now populated

**Customer self-signup (3 HTTP calls):**
1. `POST /auth/customer/emailpass/register` — Returns actorless JWT
2. `POST /store/customers` (bearer: actorless JWT) — Runs `createCustomerAccountWorkflow`: creates customer, links auth identity via `setAuthAppMetadataStep`
3. `POST /auth/token/refresh` (bearer: actorless JWT) — Returns full JWT with `actor_id` now populated

**Login (1 HTTP call, assuming verified):**
1. `POST /auth/user/emailpass` — Returns full JWT

**Login with verification required (4 HTTP calls):**
1. `POST /auth/user/emailpass` — Returns `{ verification_required: true, token: actorless }`
2. `POST /auth/verification/request` (bearer: actorless) — Returns verification code to route handler, which calls notification workflow
3. `POST /auth/verification/confirm` — Marks verified
4. `POST /auth/user/emailpass` — Re-authenticate, now returns full JWT

**Password reset (3 HTTP calls):**
1. `POST /auth/user/emailpass/reset-password` — Generates reset JWT, calls notification workflow (always returns 201)
2. `POST /auth/user/emailpass/update` (bearer: reset JWT) — New password hashed and stored
3. User re-authenticates via normal login flow

### Identity-to-Actor Linking

The auth module and user module are connected via `app_metadata` on the auth identity, not a direct FK or link module. The linking primitive is a workflow step (`setAuthAppMetadataStep`) that:
> Medusa source: `packages/core/core-flows/src/auth/steps/set-auth-app-metadata.ts`

1. Constructs key `{actorType}_id` (e.g., `user_id`)
2. Guards against overwriting (throws if key already exists and new value is non-null)
3. Writes `app_metadata[key] = userId`
4. Compensation: restores old value or deletes key on rollback

This step is composed into `acceptInviteWorkflow` (admin users) and `createCustomerAccountWorkflow` (customer self-signup). The auth module itself is unaware of users, customers, or invites — it only knows about auth identities and their `app_metadata`.

### Claimable Identities

When a user registers with an email that already has an auth identity (e.g., created during an invite flow) but the identity has no `app_metadata` (no linked actor), the emailpass provider treats it as "claimable" — it updates the existing identity with the new password hash instead of rejecting with "already exists." This supports the flow where an admin creates an invite, the system pre-creates an auth identity, and the user later registers to claim it.

### Actor Types

`actor_type` is the routing concept that connects an auth identity to a concrete entity in the system. It determines which entity table an identity maps to, which routes a token can access, and which providers are allowed.

> Medusa uses a bare `string` for `actor_type`. We use a union type to catch typos at compile time.

```typescript
type ActorType = "user" | "customer"
```

| Value | Entity | `app_metadata` key | Protected namespace |
|-------|--------|-------------------|---------------------|
| `"user"` | Admin user | `user_id` | `/admin/**` |
| `"customer"` | Storefront customer | `customer_id` | `/store/**` |

**Where it lives:**

1. **URL path parameter** — Auth routes use `:actor_type` as a path segment: `POST /auth/:actor_type/:auth_provider`. This is where the value originates during registration and login.

2. **JWT payload** — Embedded as `actor_type` in the signed token. The `authenticate` middleware reads it to check whether the token is permitted for the current route.

3. **`app_metadata` key convention** — The formula `${actorType}_id` links an auth identity to its concrete entity. `setAuthAppMetadataStep` writes `app_metadata.user_id = "usr_abc"` for actor type `"user"`, and `app_metadata.customer_id = "cus_xyz"` for `"customer"`. `generateJwtTokenForAuthIdentity` reads the same key to populate `actor_id` in the JWT.

4. **Configuration maps** — `authMethodsPerActor` and `authVerificationsPerActor` use `ActorType` as their key type, restricting which providers and verification requirements apply per actor type.

5. **Middleware** — `authenticate("user", ["bearer"])` restricts a route to tokens with `actor_type: "user"`. The wildcard `"*"` permits any actor type (used on shared auth routes like token refresh).

**Adding a new actor type** requires: (1) adding the value to the `ActorType` union, (2) creating the corresponding entity module, (3) building a `create{Actor}AccountWorkflow` that calls `setAuthAppMetadataStep`, (4) adding entries to `authMethodsPerActor` and optionally `authVerificationsPerActor`.

### Configuration

Two configuration surfaces:

#### 1. JWT Config (environment variables)

JWT configuration comes from environment variables, validated by Zod at startup alongside the rest of the app config in `env.ts`:

```typescript
const envSchema = z.object({
  // ... existing vars
  JWT_SECRET: z.string(),                    // Required. Signing key (and symmetric verification key).
  JWT_PUBLIC_KEY: z.string().default(''),     // Optional. For asymmetric (RS256) verification.
  JWT_EXPIRES_IN: z.string().default('1d'),   // Controls token lifetime.
})
```

No silent dev fallback — if `JWT_SECRET` is missing, startup fails with a clear Zod validation error.

#### 2. Auth Config (`core/auth/config.ts`)

Static per-deployment config for auth scope and verification rules. Lives in `core/auth/config.ts` alongside the utilities that consume it (`validateScopeProviderAssociation`, `validateVerification`, `generateJwtTokenWithChecks`).

> In Medusa these live in `projectConfig.http` inside `medusa-config.ts`, resolved at runtime via the config module DI container. For proteus, a typed config file is simpler — no config module indirection, direct imports, and co-located with consumers.

```typescript
// core/auth/config.ts
import type { ActorType } from './types.js'

/**
 * Controls which auth providers each actor type can use.
 * Enforced by `validateScopeProviderAssociation` middleware.
 * If absent for an actor type, all providers are allowed.
 */
export const authMethodsPerActor: Partial<Record<ActorType, string[]>> = {
  user: ["emailpass"],
  customer: ["emailpass"],
}

/**
 * Controls which actor types require entity verification (e.g., email)
 * and with which auth providers. Checked by `generateJwtTokenWithChecks`
 * at login and token refresh. If absent for an actor type, no verification required.
 */
export const authVerificationsPerActor: Partial<
  Record<ActorType, { entity_type: string; auth_provider: string }[]>
> = {
  customer: [{ entity_type: "email", auth_provider: "emailpass" }],
}
```

### Module Structure

Follows existing proteus module conventions:

```
modules/auth/
  models/
    auth-identity.ts
    provider-identity.ts
    auth-verification.ts
    auth-password-reset-token.ts
  repositories/
    auth-identity.ts
    provider-identity.ts
    auth-verification.ts
    auth-password-reset-token.ts
  services/
    auth-module-service.ts
    auth-provider-service.ts       # routes to au_* providers via AuthIdentityProviderService proxy
    verification-provider-service.ts  # routes to verif_* providers with sharedContext
  providers/
    emailpass.ts                   # extends AbstractAuthModuleProvider (uses proxy, extractable later)
    verification/
      token.ts                     # implements IAuthVerificationProvider (needs authVerificationService)
  loaders/
    providers.ts                   # registers au_* via moduleProviderLoader, verif_* via direct import
  utils/
    verification-token.ts          # generateVerificationToken, hashVerificationToken
    password.ts                    # hashPassword, verifyPassword (wrappers around scrypt-kdf library)
  migrations/
  __tests__/
  index.ts                         # Module(Modules.AUTH, { service, repositories, loaders })
```

Both providers live inside the auth module for the MVP. The emailpass provider uses only the `AuthIdentityProviderService` proxy (no direct DB access), so it can be extracted to a standalone package later without code changes — just move it and load it via `moduleProviderLoader` instead of direct import. The token verification provider must remain inside because it depends on `authVerificationService` (module-private internal service).

The JWT infrastructure lives outside the auth module, in `core/auth/`:

```
core/auth/
  middleware/
    authenticate.ts              # authenticate() factory, getAuthContextFromJwtToken
  utils/
    token.ts                     # generateJwtToken (the single jwt.sign wrapper)
    generate-jwt-token.ts        # generateJwtTokenWithChecks, generateJwtTokenForAuthIdentity
    validate-token.ts            # validateToken middleware for reset JWTs
    validate-verification.ts     # validateVerification (reads authVerificationsPerActor config)
    validate-scope-provider-association.ts  # provider allowlist middleware
  types.ts                       # AuthContext, AuthenticatedMedusaRequest
```

The auth API routes remain in the API layer:

```
api/auth/
  token/refresh/route.ts         # POST (re-sign with fresh data)
  middlewares.ts                 # per-route auth middleware declarations
```

### Email Delivery (TODO: Notification Module)

The auth module does **not** emit events. Instead, the auth service returns plaintext tokens and signed reset JWTs directly to the route handler. The route handler calls a workflow that forwards these to the notification module for email delivery.

The notification module is not built yet. During implementation, leave a TODO at each callsite:

```typescript
// TODO(notifications): call sendVerificationEmail workflow once notification module lands
// For now, log the verification code to console in development.
```

```typescript
// TODO(notifications): call sendPasswordResetEmail workflow once notification module lands
// For now, log the reset JWT to console in development.
```

**Two workflows to build when notification module ships:**

- `requestVerificationWorkflow` — Takes auth module output (`entity_id`, `entity_type`, `code`, `expires_at`), calls notification module to send verification email.
- `requestPasswordResetWorkflow` — Takes auth module output (`entity_id`, `actor_type`, `token`), calls notification module to send password reset email.

Until the notification module exists, these flows are non-functional end-to-end in production. In development, the plaintext values are logged to console so the developer can manually complete the flow.

### Security Measures

**Credential protection:**
- Password hashes stripped from all API responses and JWT payloads (sanitization in emailpass provider)
- Verification tokens and reset JTIs stored as SHA-256 hashes only; plaintext never persisted
- `JWT_SECRET` is required by the Zod env schema — startup fails if missing (no silent fallback)

**Password reset:**
- Password reset endpoint always returns 201 regardless of identity existence (prevents email enumeration)
- Password reset tokens are single-use: DB record hard-deleted on first consumption
- Prior reset tokens invalidated on each new reset request (one active token per identity)
- Reset JWT is purpose-bound (`purpose: "reset"` claim) — ordinary JWTs rejected at the update endpoint
- Reset JWT has `jti` claim linking to DB record — token without matching DB row is rejected
- Reset JWT has hardcoded 15-minute TTL independent of auth JWT lifetime
- Expired tokens cleaned up on consumption attempt (deleted before rejection)
- `entity_id` in password update injected from validated token context, not trusted from request body

**Verification:**
- Verification codes are single-use: `verified_at` check prevents re-confirmation
- Re-requesting verification rotates the token (old code becomes invalid)

**JWT security:**
- Actorless JWTs have `actor_id: ""` — they cannot access regular protected API routes
- `jsonwebtoken.verify()` hardcodes `ignoreExpiration: false` and `ignoreNotBefore: false` as own properties to guard against prototype pollution
- `JWT_PUBLIC_KEY` support enables asymmetric signing (RS256) — signing key and verification key can be separated
- Bearer token verification returns `null` on any exception — the caller decides 401 vs fallthrough

**JWT-only tradeoffs:**
- Tokens cannot be revoked server-side before expiry. Logout is client-side only (discard the token). This is acceptable for the MVP — server-side revocation (e.g., a token blacklist) can be added later if needed.
- Token lifetime (`JWT_EXPIRES_IN`, default `"1d"`) is the sole control for how long a user stays authenticated. Shorter values (e.g., `"1h"`) are safer but require more frequent refresh calls.
- JWT payloads are a point-in-time snapshot. Role changes, metadata updates, and other state changes are not reflected until the user calls token refresh. This is a known tradeoff vs per-request DB lookups.
- Tokens stored in `localStorage`/`sessionStorage` in browser SPAs are readable by XSS payloads. This is a standard tradeoff of JWT-in-browser vs httpOnly cookies.

## Out of Scope

- **MFA** (TOTP, recovery codes, challenge flow, cache-based attempt tracking) — No models, services, or routes for multi-factor authentication
- **OAuth providers** (Google, GitHub, etc.) — The provider architecture supports them but no OAuth providers ship with the MVP
- **API key authentication** — No API key middleware or resolution logic
- **Session-based authentication** — No server-side sessions, no session store (Redis/DynamoDB/memory), no session endpoints. JWT bearer tokens are the sole auth mechanism. Sessions can be layered on later as an alternative auth strategy without modifying the JWT infrastructure.
- **Token revocation / blacklisting** — No server-side mechanism to invalidate tokens before expiry. Logout is client-side. A token blacklist or revocation list can be added later if needed.
- **Notification module** — The auth module returns plaintext tokens/JWTs to the route handler, but the notification module (email delivery) does not exist yet. Verification and password reset workflows will call the notification module once it ships. Until then, tokens are logged to console in development.
- **Rate limiting** — No rate limiting on login, registration, verification, or password reset endpoints
- **Account lockout** — No lockout after failed login attempts
- **Password complexity validation** — No minimum length or complexity rules enforced by the auth module (can be added at the API validation layer)
- **Access control module integration** — The auth module provides `req.auth_context.actor_id` which the future access control middleware will consume, but no access control middleware or permission checking is part of this spec
- **Admin UI for auth management** — No dashboard screens for managing auth identities, providers, or verification records

## Further Notes

- **Notification module is the next dependency.** The verification and password reset flows return plaintext tokens to the route handler, which will forward them to the notification module via a workflow. Until the notification module is built, these flows log to console in development and are non-functional in production. The notification module should be the first thing built after the auth module.
- **Token refresh vs re-authentication.** After invite accept, the client must call token refresh (not re-authenticate) to get a full JWT. Re-authentication would require the user to re-enter their password, which is poor UX. Token refresh re-signs the JWT with fresh `app_metadata` (which now includes `user_id`).
- **Claimable identity edge case.** The emailpass provider allows "claiming" an existing identity with empty `app_metadata`. This is intentional — it supports the invite flow where the identity is pre-created. However, if an identity has `app_metadata` set (actor already linked), registration with the same email is rejected with "Identity with email already exists."
- **Verification timing.** Verification is checked at login time, not at registration time. A user can register and accept an invite without verifying their email. The verification gate activates when they try to log in — `generateJwtTokenWithChecks` returns `verification_required` instead of a full token. This means unverified users can complete the signup ceremony but cannot get full tokens for regular API access.
- **Two JWT secrets consideration.** In Medusa, invite tokens are signed with the User module's own JWT secret (separate from the HTTP JWT secret). This is a defense-in-depth measure — a leaked auth JWT cannot forge invite tokens. The same pattern should be considered for proteus: the invite token secret lives in the user module config, the auth ceremony JWT secret lives in the auth module config.
- **Token lifetime matters more without sessions.** With JWT-only, `JWT_EXPIRES_IN` (default `"1d"`) is the sole control for authentication duration. There is no independent session TTL. Choose a lifetime that balances security (shorter = less exposure window if token is stolen) against UX (longer = fewer refresh interruptions). Reset JWTs have a hardcoded 15-minute TTL regardless of `JWT_EXPIRES_IN`.
- **Asymmetric JWT support.** Setting `JWT_PUBLIC_KEY` enables RS256 or other asymmetric algorithms. In this setup, `JWT_SECRET` holds the private key (for signing), `JWT_PUBLIC_KEY` holds the public key (for verification). The `getAuthContextFromJwtToken` function uses `JWT_PUBLIC_KEY || JWT_SECRET` for verification, so asymmetric setups are transparent to the rest of the system.
- **Token refresh re-runs all gates.** When an actorless token is refreshed, the system re-runs `validateAuthIdentity` and `generateJwtTokenWithChecks`, which re-checks verification status. This means refreshing during a blocked state returns the gated response (not a full token). Only when all gates pass does refresh produce a full JWT.
- **Adding sessions later.** The JWT-only architecture does not preclude adding session support later. Sessions would be an additional auth strategy alongside bearer tokens — the `authenticate` middleware already supports multiple strategies by design. Adding sessions would require: (1) `express-session` middleware in the HTTP layer, (2) session create/destroy endpoints, (3) `getAuthContextFromSession()` in the authenticate middleware, (4) a session store (Redis or similar). None of the JWT infrastructure would need to change.
