# 03 — Workflow steps

**What to build:** Two workflow steps that let any workflow trigger notifications. `sendNotificationsStep` sends immediately during workflow execution (no compensation — notifications are irreversible). `notifyOnFailureStep` is placed early in a workflow and only sends when the workflow rolls back — its main function is a no-op that stores the notification payload as compensation data.

**Blocked by:** 01 — Notification module core + provider system

**Status:** ready-for-agent

## Acceptance criteria

- [ ] `sendNotificationsStep` resolves `NotificationModuleService` from the container, calls `createNotifications(data)`, has no compensation function
- [ ] `notifyOnFailureStep` main function is a no-op returning the notification payload as compensation data via step response; compensation function calls `createNotifications` with the stored payload on workflow rollback
- [ ] Both steps follow the existing workflow step patterns in the codebase
