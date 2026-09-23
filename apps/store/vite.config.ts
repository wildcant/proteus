import { cloudflare } from '@cloudflare/vite-plugin'
import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig(({ command }) => ({
  resolve: { tsconfigPaths: true },
  server: {
    proxy: {
      '/static': process.env.VITE_BACKEND_URL ?? 'http://localhost:3000',
    },
  },
  plugins: [
    devtools(),
    tailwindcss(),
    cloudflare({
      viteEnvironment: { name: 'ssr' },
      config: {
        vars: {
          RUNTIME: 'workerd',
          // Inject host env vars into the Worker so they're available in process.env at bootstrap time (env.ts)
          ...(command === 'serve' ? JSON.parse(JSON.stringify(process.env)) : {}),
        },
      },
    }),
    tanstackStart(),
    viteReact(),
    // `.po` imports compile to message modules; `@vitejs/plugin-react` 6 runs no Babel, so the Lingui
    // macros get their own pass.
    lingui({ cwd: import.meta.dirname }),
    babel({ presets: [linguiTransformerBabelPreset({}, { cwd: import.meta.dirname })] }),
  ],
}))
