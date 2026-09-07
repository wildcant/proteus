import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/**
 * Two levels, and the split is about what a claim needs to be true.
 *
 * - **unit** — functions whose edges are far easier to see directly than through a rendered page.
 *   The expiry bucketing is the type case: twelve cases and a clock, or twelve fixtures and a
 *   rendered card list.
 * - **browser** — components, rendered in a real Chromium rather than a DOM emulation. Everything
 *   these assert is render and interaction logic: what a row is labelled, what is disabled, what a
 *   list does with the order it was given. They mount a component with props and never speak to an
 *   API, which is what keeps them honest — a component test that needed a stubbed endpoint would be
 *   an integration test wearing the wrong clothes.
 *
 * Above both sits Playwright in `tests/e2e`, which runs the real backend and never fakes a response
 * from it. Below them sits the backend suite, which owns anything about what the server does.
 */
export default defineConfig({
  // Native tsconfig paths, exactly as `vite.config.ts` resolves them. Not a hand-written `#`
  // alias: `@proteus/ui` declares its own `#/*` subpath import, and a global alias of the same
  // name captures it and sends the package's internals into this app's `src`.
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
      },
      {
        extends: true,
        // React and Tailwind only for the project that renders them; the unit project stays a
        // plain node run.
        plugins: [react(), tailwindcss()],
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
            headless: true,
          },
          setupFiles: ['./vitest.browser.setup.ts'],
        },
      },
    ],
  },
})
