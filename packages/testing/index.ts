// The values an e2e spec has to share with the server it drives, so a typo on either side fails
// rather than passes. They are re-exported here because this package is the one place the e2e
// suites reach the backend from — the apps themselves declare no dependency on it.
export { NotificationTemplates, PaymentErrorCodes } from 'backend/test'
export { db, shutdown } from './db/client.js'
export { default as globalSetup } from './fixtures/global-setup.js'
export type { CleanupFunction, Factories } from './fixtures/test-extend.js'
export { createTest, expect } from './fixtures/test-extend.js'
export { BACKEND_TIMEOUT, pollDatabase } from './utils/poll.js'
