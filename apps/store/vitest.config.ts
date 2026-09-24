import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/**
 * Two levels, and the split is about what a claim needs to be true.
 *
 * - **unit** — functions whose edges are far easier to see directly than through a rendered page.
 *   `utils/expiry.test.ts` is the type case: the whole of it is one month comparison, and stating
 *   its boundaries takes a table and an injected clock rather than a fixture and a card list per
 *   case.
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
        // Start's plugin gives the client bundle the client half of Start; this project has no
        // Start plugin, so the stub stands in for it. Exact matches, so nothing else under the scope moves.
        resolve: {
          alias: [
            {
              find: /^@tanstack\/react-start(\/server)?$/,
              replacement: fileURLToPath(new URL('./vitest.start-client.stub.ts', import.meta.url)),
            },
          ],
        },
        // A component that owns a mutation — the PDP's action bar is one — imports its way to the
        // generated client, and `src/env.ts` refuses to load without a backend address. Defined
        // here rather than pulled from `.env`: nothing in this project sends a request, so the
        // value only has to parse, and a real address would invite a test to use it.
        define: { 'import.meta.env.VITE_BACKEND_URL': JSON.stringify('http://component-tests.invalid') },
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
