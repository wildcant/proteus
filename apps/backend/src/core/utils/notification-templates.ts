/**
 * Template names the notification providers render by.
 *
 * Named here rather than inline at each call site so the workflow that sends a
 * notification and anything that later looks it up agree on the string.
 */
export const NotificationTemplates = {
  VERIFY_EMAIL: 'verify-email',
  RESET_PASSWORD: 'reset-password',
  ADMIN_INVITATION: 'admin-invitation',
  ORDER_CONFIRMATION: 'order-confirmation',
  WORKFLOW_FAILED: 'workflow-failed',
  CHECKOUT_FAILED: 'checkout-failed',
  ORDER_CONFIRMATION_FAILED: 'order-confirmation-failed',
} as const

export type NotificationTemplate = (typeof NotificationTemplates)[keyof typeof NotificationTemplates]
