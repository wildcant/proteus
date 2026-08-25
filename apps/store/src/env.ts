// Kept outside createEnv() so it stays a build-time literal: that is what lets
// `PREFILL_FORMS ? TEST : EMPTY` fold away and tree-shake dev-only values out of production.
// Off under `vite --mode test` so e2e specs control their own input.
export const PREFILL_FORMS = import.meta.env.DEV && import.meta.env.MODE !== 'test'

// Overridable because which address receives mail depends on the email provider.
// Signup plus-tags it: that address must not already exist.
export const DEV_EMAIL = import.meta.env.DEV ? (import.meta.env.VITE_DEV_EMAIL ?? 'delivered@resend.dev') : ''
export const DEV_SIGNUP_EMAIL = import.meta.env.DEV ? DEV_EMAIL.replace('@', '+signup@') : ''

function createEnv() {
  const url = import.meta.env.VITE_BACKEND_URL
  if (!url) throw new Error('Missing required env var: VITE_BACKEND_URL')
  try {
    new URL(url)
  } catch {
    throw new Error(`VITE_BACKEND_URL is not a valid URL: "${url}"`)
  }
  return { VITE_BACKEND_URL: url as string }
}

export const env = createEnv()
