import { defineConfig } from 'vitest/config'

/**
 * The package is schemas, not behaviour, so there is exactly one thing here worth asserting:
 * the ceilings in `src/bounded.ts`. Everything downstream — what the API accepts, what the
 * generated spec says — follows from those numbers, and nothing else in the repo pins them.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
