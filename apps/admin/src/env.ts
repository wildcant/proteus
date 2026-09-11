import { z } from 'zod'

// Kept outside createEnv() so it stays a build-time literal, which is what lets the devtools
// block fold away and tree-shake out of the production bundle. Off under `vite --mode test`
// because the devtools trigger is a fixed 100x100 button pinned bottom-right — exactly where a
// RouteDrawer puts its Cancel/Save footer. It sits outside the dialog's portal, so it intercepts
// clicks on Save and no e2e spec can reach the button.
export const SHOW_DEVTOOLS = import.meta.env.DEV && import.meta.env.MODE !== 'test'

const envSchema = z.object({
  VITE_BACKEND_URL: z.url(),
})

function createEnv() {
  const result = envSchema.safeParse(import.meta.env)

  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid environment variables:\n${issues}`)
  }

  return result.data
}

export const env = createEnv()
