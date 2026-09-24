import { fileURLToPath } from 'node:url'
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin'
import babel from '@rolldown/plugin-babel'
import { defineConfig } from 'vitest/config'

/**
 * Pure logic only. Everything that needs a database lives in the backend suite, and everything
 * that needs a browser lives in Playwright — this covers the handful of functions in between.
 * Lingui runs as in `vite.config.ts`, so admin copy and its `.po` catalogs load under test.
 */
export default defineConfig({
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  resolve: { alias: { '#': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    lingui({ cwd: import.meta.dirname }),
    babel({ presets: [linguiTransformerBabelPreset({}, { cwd: import.meta.dirname })] }),
  ],
})
