import { resolve } from 'node:path'
import { config } from '@dotenvx/dotenvx'
import { defineConfig } from 'vitest/config'

const { parsed: testEnv } = config({ path: resolve(__dirname, '../../.env.test'), override: true })

export default defineConfig({
  resolve: {
    alias: {
      '@tests': resolve(__dirname, './tests'),
      '@core': resolve(__dirname, './src/core'),
      '@framework': resolve(__dirname, './src/framework'),
      '@workflows': resolve(__dirname, './src/workflows'),
    },
  },
  test: {
    env: testEnv ?? {},
    include: ['./src/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup/setup-test-env.ts'],
    fileParallelism: false,
    restoreMocks: true,
    coverage: {
      include: ['src/**/*.{ts}'],
    },
  },
})
