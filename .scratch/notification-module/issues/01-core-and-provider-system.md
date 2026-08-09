# 01 — Notification module core + provider system

**What to build:** A fully functional notification module that can create, persist, and dispatch notifications through channel-specific providers. Workflow steps call `createNotifications` with a batch of notifications, each routed to the correct provider by channel. Duplicate sends are prevented via idempotency keys (failed notifications can be retried). Every notification is persisted with status tracking (PENDING -> SUCCESS/FAILURE). The app boots with the module registered and a local provider handling the `"feed"` channel (logs to console). The full flow is verified by integration tests against a real Postgres database.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] Notification types defined in `core/types/notification/`: `INotificationProvider` (single `send` method), `NotificationProviderConfig` (with first-class `channels` field), `NotificationModuleOptions`, DTOs (`NotificationDTO`, `CreateNotificationDTO`, filter types), provider send input/output types, service interface
- [ ] `AbstractNotificationProviderService` in `core/utils/` with static `identifier`, static `validateOptions()`, and default `send()` that throws
- [ ] Drizzle models for `notification` table (prefixed `noti_`, fields: `to`, `from`, `channel`, `template`, `data`, `providerData`, `triggerType`, `resourceId`, `resourceType`, `receiverId`, `originalNotificationId`, `idempotencyKey` (unique), `externalId`, `status` enum, `providerId` FK, timestamps) and `notificationProvider` table (prefixed `notpro_`, fields: `handle`, `name`, `isEnabled`, `channels` json array, timestamps)
- [ ] `NotificationRepository` and `NotificationProviderRepository` via `BaseRepository(table)`
- [ ] `NotificationProviderService` — channel-to-provider in-memory cache (lazy, from DB), DI container lookup via `np_<identifier>_<id>`, `send()` delegation
- [ ] `NotificationModuleService` — `createNotifications` (batch + singular), `retrieveNotification`, `listNotifications`, `listAndCountNotifications`. The `createNotifications` flow: inside `withTransaction`: idempotency check (DB query, skip non-failure duplicates), provider resolution, create PENDING records. Outside the transaction: dispatch via `Promise.all`, status update in `finally` block
- [ ] Local notification provider at `providers/notification-feed-local/` extending the abstract base, logging to console, returning `{}`
- [ ] Provider loader: registers providers in DI under `np_<identifier>_<id>`, upserts to DB, validates one-provider-per-channel (throws on duplicates), marks removed providers `isEnabled: false`, skips DB upsert on `env.RUNTIME === 'workerd'`
- [ ] Provider declarations file exporting `notificationProviderDeclarations: NotificationModuleOptions` with local provider configured for `channels: ['feed']`
- [ ] Module registered via `Module(Modules.NOTIFICATION, ...)`, bootstrapped in `container.ts` with `bootstrapModule(container, notificationModule, notificationProviderDeclarations)`
- [ ] Database migration config at `modules/notification/database.config.ts`
- [ ] Integration tests (mocked `NotificationProviderService`, same pattern as payment module tests): batch creation with status tracking, idempotency (SUCCESS skipped, FAILURE retried), provider failure sets FAILURE status without blocking other notifications in batch, missing provider sets FAILURE, `retrieveNotification` by ID and NOT_FOUND, `listNotifications` with pagination and filters, `listAndCountNotifications`
- [ ] Test fixture `generateCreateNotification` added to `dto.generate`
