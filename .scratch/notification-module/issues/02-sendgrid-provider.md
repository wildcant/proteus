# 02 — SendGrid provider

**What to build:** A SendGrid notification provider that can send transactional emails. Supports two modes: template mode (SendGrid dynamic templates via `templateId`) and content mode (inline `subject` + `html`). Handles attachments (base64 content, filename, MIME type) and SendGrid `personalizations` via `providerData`. Falls back to a configured `from` address when the notification doesn't specify one. Uses the `@sendgrid/mail` package.

**Blocked by:** 01 — Notification module core + provider system

**Status:** ready-for-agent

## Acceptance criteria

- [ ] SendGrid provider at `providers/notification-email-sendgrid/` extending `AbstractNotificationProviderService` with `identifier: 'notification-sendgrid'`
- [ ] Template mode: when `template` is set, uses it as SendGrid's `templateId` with `data` as dynamic template variables
- [ ] Content mode: when `template` is not set, reads `subject` and `html` from the notification content
- [ ] Attachments: maps `attachments` array (base64 `content`, `filename`, MIME `type`) to SendGrid's attachment format
- [ ] Personalizations: forwards `providerData.personalizations` to SendGrid's `personalizations` field
- [ ] Falls back to `options.from` when `notification.from` is not provided
- [ ] Returns `{ id }` from SendGrid's API response
- [ ] `@sendgrid/mail` added as a dependency
- [ ] `env.ts` updated with `SENDGRID_API_KEY` and `SENDGRID_FROM` as required env vars
- [ ] Provider declarations updated to include SendGrid with `channels: ['email']` alongside local with `channels: ['feed']`
