# 04 — Admin API + notification UI

**What to build:** Admin-facing read-only API endpoints for querying notifications, plus an in-app notification feed in the admin dashboard. Admins see a bell icon that opens a drawer with an infinite-scrolling list of `channel: "feed"` notifications. Unread tracking uses localStorage — the bell shows a dot when new notifications arrive, cleared on drawer open. The list polls every 60 seconds.

**Blocked by:** 01 — Notification module core + provider system

**Status:** ready-for-agent

## Acceptance criteria

### Admin API

- [ ] `GET /admin/notifications` — list endpoint with filters for `channel`, `to`, `id`, and search query `q`; default limit 50, sorted by `-createdAt`; returns `id`, `to`, `channel`, `template`, `data`, `triggerType`, `resourceId`, `resourceType`, `receiverId`, `createdAt`, `updatedAt`
- [ ] `GET /admin/notifications/:id` — retrieve single notification by ID
- [ ] Both endpoints are read-only (no create/update/delete routes)
- [ ] Validators, middleware, and query config follow existing admin API patterns
- [ ] http-schemas updated with notification response and query schemas

### Admin UI

- [ ] Bell icon in the admin layout that toggles a notification drawer
- [ ] Drawer shows an infinite-scrolling list of notifications queried with `channel: "feed"` filtered to current user's ID and email
- [ ] Each notification renders its `data.title`, optional `data.description`, optional `data.file` (with download link), and relative timestamp
- [ ] Unread tracking via localStorage: stores `notificationsLastReadAt` timestamp, compares against latest notification's `createdAt`
- [ ] Unread dot indicator on the bell icon clears when drawer opens
- [ ] Notifications polled every 60 seconds to update unread state
- [ ] Keyboard shortcut (Cmd/Ctrl+N) toggles the drawer
- [ ] Orval client regenerated to include notification endpoints
