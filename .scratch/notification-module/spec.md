# Notification Module

## Problem Statement

Proteus has no way to send notifications to users or admins. When events like order completion or export jobs finish, there is no mechanism to inform anyone -- no email, no in-app feed, nothing. As the platform grows, the ability to notify through multiple channels (email, in-app feed, SMS) with pluggable providers becomes essential infrastructure.

## Solution

Introduce a notification module that acts as a channel-agnostic dispatch system. It routes messages to the correct provider based on a `channel` field, persists every notification attempt with status tracking (PENDING -> SUCCESS/FAILURE), supports idempotency, and enforces one-provider-per-channel at startup. Two trigger paths exist: a `sendNotificationsStep` for immediate dispatch during workflows, and a `notifyOnFailureStep` that sends notifications only when a workflow rolls back. The admin gets a read-only API to query notifications and a bell-icon drawer UI with unread tracking.

## User Stories

1. As a developer, I want to register notification providers via a declaration file, so that I can configure which providers handle which channels at startup.
2. As a developer, I want only one provider per channel enforced at startup, so that notification routing is deterministic and I don't get duplicate sends.
3. As a developer, I want providers that are removed from config to be marked `isEnabled: false` in the DB rather than deleted, so that historical notification records retain their provider association.
4. As a developer, I want a local notification provider that logs to console and returns `{}`, so that I can test notification flows in development without external services.
5. As a developer, I want a SendGrid notification provider that supports template mode (dynamic templates) and content mode (inline subject + HTML), so that I can send transactional emails in production.
6. As a developer, I want the SendGrid provider to handle attachments (base64 content, filename, MIME type), so that I can send emails with file attachments.
7. As a developer, I want the SendGrid provider to fall back to a configured `from` address when the notification doesn't specify one, so that emails always have a sender.
8. As a developer, I want to call `createNotifications` with a batch of notifications, so that multiple notifications can be processed in a single call.
9. As a developer, I want idempotency via an `idempotencyKey` field, so that duplicate sends are prevented when the same notification is submitted twice.
10. As a developer, I want failed notifications with the same idempotency key to be retried, so that transient failures don't permanently block a notification.
11. As a developer, I want notifications created with PENDING status inside a transaction before the provider is called, so that concurrent requests don't double-process the same notification.
12. As a developer, I want provider dispatch to happen outside the transaction, so that external side effects don't hold open DB transactions.
13. As a developer, I want status updates (SUCCESS/FAILURE) written in a finally block, so that statuses are always persisted regardless of errors.
14. As a developer, I want to use `sendNotificationsStep` in workflows to send notifications immediately during execution, so that I can notify users as part of a workflow.
15. As a developer, I want `sendNotificationsStep` to have no compensation function, so that sent notifications are never rolled back (notifications are irreversible).
16. As a developer, I want to use `notifyOnFailureStep` early in a workflow, so that when any subsequent step fails and the workflow rolls back, a failure notification is automatically sent.
17. As a developer, I want `notifyOnFailureStep`'s main function to be a no-op that stores notification data as compensation data, so that the notification is only sent on rollback.
18. As an admin, I want to list notifications via `GET /admin/notifications` with filters for `channel`, `to`, `id`, and a search query `q`, so that I can review notification history.
19. As an admin, I want to retrieve a single notification via `GET /admin/notifications/:id`, so that I can inspect a specific notification's details.
20. As an admin, I want notifications to be read-only via the API (no create/update/delete routes), so that the audit trail is never tampered with from the admin panel.
21. As an admin, I want a bell icon in the admin UI that opens a drawer with an infinite-scrolling list of notifications filtered to `channel: "feed"` and my user ID/email, so that I can see in-app notifications.
22. As an admin, I want unread notification tracking via localStorage (comparing last notification timestamp to last-read timestamp), so that the bell icon shows an unread indicator.
23. As an admin, I want the unread indicator to clear when I open the notification drawer, so that I know I've seen the latest notifications.
24. As an admin, I want notifications polled every 60 seconds, so that the unread indicator updates without a page refresh.
25. As a developer, I want every notification attempt persisted in the database with its full status history, so that the notification table serves as a complete audit trail.
26. As a developer, I want the channel-to-provider mapping cached in memory after first lookup, so that provider resolution is fast and doesn't hit the DB on every send.

## Implementation Decisions

### Module Structure

The notification module follows the established module layout at `modules/notification/` with `models/`, `repositories/`, `services/`, `loaders/`, and `__tests__/` directories. It registers via `Module(Modules.NOTIFICATION, ...)` and is bootstrapped in `container.ts` with `bootstrapModule(container, notificationModule, notificationProviderDeclarations)`.

### Data Models (Drizzle, camelCase columns)

**`notification` table:**
- `id` (prefixed `noti_`), `to` (text, searchable), `from` (text, nullable), `channel` (text), `template` (text, nullable), `data` (json, nullable), `providerData` (json, nullable), `triggerType` (text, nullable), `resourceId` (text, searchable, nullable), `resourceType` (text, nullable), `receiverId` (text, indexed, nullable), `originalNotificationId` (text, nullable), `idempotencyKey` (text, unique, nullable), `externalId` (text, nullable), `status` (text enum: `pending`, `success`, `failure`), `providerId` (FK to notificationProvider), timestamps.

**`notificationProvider` table:**
- `id` (prefixed `notpro_`), `handle` (text), `name` (text), `isEnabled` (boolean, default true), `channels` (json array), timestamps. Has a one-to-many relation to `notification`.

### Two-Service Split

- `NotificationModuleService` -- public-facing service exposing `createNotifications`, `createNotification`, `retrieveNotification`, `listNotifications`, `listAndCountNotifications`.
- `NotificationProviderService` -- internal service handling channel-to-provider mapping (lazy in-memory cache from DB), DI container lookup via `np_<identifier>_<id>` keys, and delegating `send()` calls.

### Provider Interface and Abstract Base

Types live at `core/types/notification/`. `INotificationProvider` has a single `send(notification)` method returning `Promise<{ id?: string }>`. `AbstractNotificationProviderService` at `core/utils/abstract-notification-provider.ts` provides a static `identifier`, static `validateOptions()`, and a default `send()` that throws "not implemented".

### Provider Configuration

Follows the auth module's pattern. Types:

```typescript
type NotificationProviderConfig = {
  resolve: ModuleProviderExports
  id: string
  channels: string[]
  options?: Record<string, unknown>
}

type NotificationModuleOptions = {
  providers?: NotificationProviderConfig[]
}
```

`channels` is a first-class required field (not buried in `options`) because it's essential for routing and validated at startup.

### Provider Declarations

`modules/notification/provider-declarations.ts` exports `notificationProviderDeclarations: NotificationModuleOptions` -- a static import array, not config-driven. Passed to `bootstrapModule()` as the third argument.

### Provider Location

Providers live at `providers/notification-feed-local/` and `providers/notification-email-sendgrid/`, following the existing provider directory pattern (alongside `auth-emailpass/`, `payment-stripe/`, etc.).

### Provider Loader

Registers each provider in DI under `np_<identifier>_<id>`, instantiates `NotificationProviderService` with the container, upserts all providers to the DB, validates one-provider-per-channel (throws on duplicates), and marks removed providers as `isEnabled: false`. Skips DB upsert on `env.RUNTIME === 'workerd'`.

### createNotifications Flow

1. **Inside `withTransaction`:**
   - **Idempotency check** -- DB query for existing notifications by idempotency keys; skip any with status !== `failure`.
   - **Provider resolution** -- `getProviderForChannels()` maps each notification's channel to a provider.
   - **Create PENDING records** -- insert all notifications with `status: 'pending'`.
2. **Outside the transaction:**
   - **Provider dispatch** -- `Promise.all` over all notifications calling `providerHandler.send()`. Missing/disabled provider -> `failure` status. Provider throws -> `failure` status + error wrapped. Success -> capture `externalId`, set `success`.
   - **Status update** -- in a `finally` block, flush all status updates to DB.

### SendGrid Provider

Uses `@sendgrid/mail` package. Two modes: template mode (uses SendGrid dynamic templates via `templateId`) or content mode (inline `subject` + `html`). Supports attachments and `personalizations` via `providerData`. Falls back to configured `from` option if notification doesn't specify one. API key is a required env var in `env.ts`.

### Workflow Steps

- `sendNotificationsStep` -- resolves `NotificationModuleService` from the container, calls `createNotifications(data)`. No compensation (irreversible).
- `notifyOnFailureStep` -- main function is a no-op storing the notification payload as compensation data via step response. Compensation function sends the notification on workflow rollback.

### Admin API

- `GET /admin/notifications` -- list with filters (`channel`, `to`, `id`, search `q`), default limit 50, sorted by `-createdAt`.
- `GET /admin/notifications/:id` -- retrieve single notification.
- Default fields: `id`, `to`, `channel`, `template`, `data`, `triggerType`, `resourceId`, `resourceType`, `receiverId`, `createdAt`, `updatedAt`.

### Admin UI

Bell icon in the admin layout. Opens a drawer with an infinite-scrolling list. Queries `GET /admin/notifications?channel=feed` filtered to current user's ID and email. Unread tracking via localStorage: stores `notificationsLastReadAt` timestamp, compares against latest notification's `createdAt`. Polls every 60 seconds. Unread dot clears on drawer open.

### Environment Variables

SendGrid-related env vars (`SENDGRID_API_KEY`, `SENDGRID_FROM`) are added to `env.ts` as required fields when the SendGrid provider is configured.

## Testing Decisions

### Testing Seam

The primary testing seam is `NotificationModuleService`, tested as integration tests against a real Postgres database. This is the highest seam that covers the most behavior -- from idempotency checks through provider dispatch to status updates.

`NotificationProviderService` is mocked in `NotificationModuleService` tests (same pattern as `PaymentModuleService` mocking `PaymentProviderService`). This lets tests verify the full `createNotifications` flow without hitting external providers.

### What Makes a Good Test

Tests should verify external behavior through the service interface, not implementation details. Test the contract: "given these inputs, expect these outputs and these side effects." Don't test internal method calls, private state, or repository queries directly.

### Prior Art

- `modules/product/__tests__/product-module-service.test.ts` -- CRUD tests with `dto.generate` fixtures, `getDb`/`logger` from test-extend, manual service construction.
- `modules/payment/__tests__/payment-module-service.test.ts` -- mock provider service pattern, lifecycle tests, idempotency tests.

### Test Cases for NotificationModuleService

- `createNotifications` -- batch creation, status tracking (PENDING -> SUCCESS), provider called with correct input, `externalId` captured from provider response.
- `createNotifications` idempotency -- duplicate `idempotencyKey` with SUCCESS status is skipped; duplicate with FAILURE status is retried.
- `createNotifications` provider failure -- provider throws, status set to FAILURE, error recorded but other notifications in batch still attempted.
- `createNotifications` missing provider -- channel has no registered provider, status set to FAILURE.
- `retrieveNotification` -- returns by ID, throws NOT_FOUND for non-existent.
- `listNotifications` -- pagination, filtering by channel/to/status.
- `listAndCountNotifications` -- returns count alongside results.

### Test Fixtures

Add `generateCreateNotification` to the `dto.generate` test fixtures, producing valid `CreateNotificationDTO` objects with sensible defaults (e.g., `channel: 'email'`, `to: 'test@example.com'`, `template: 'test-template'`).

## Out of Scope

- **Event subscriber / event bus** -- notifications are triggered exclusively through workflow steps, not domain events.
- **Medusa cloud email provider** -- removed from scope.
- **Redis-based idempotency locking** -- DB-query approach is sufficient for current scale.
- **Store API** -- no customer-facing notification endpoints.
- **Create/update/delete API routes** -- notifications are read-only via API.
- **TTL / cleanup for old notifications** -- noted as a future concern for DB bloat and GDPR.
- **SMS or other channel providers** -- only local (feed) and SendGrid (email) for now.

## Further Notes

- The `"feed"` channel is just a string identifier with no special behavior. The local provider handles it via config (`channels: ['feed']`). Feed notifications are persisted to DB and queried by the admin UI -- the provider's `send()` just logs to console.
- In development, the local provider can be configured with `channels: ['feed', 'email']` to log emails instead of sending them. In production, SendGrid takes `['email']` and local takes `['feed']`.
- The Medusa source at `/Users/willo/learn/medusa/medusa-source` serves as reference for porting logic. The `NotificationModuleService.createNotifications` flow (idempotency, PENDING-before-send, parallel dispatch, finally-block status update) should be ported faithfully, adapted to Drizzle/BaseRepository/withTransaction patterns.
