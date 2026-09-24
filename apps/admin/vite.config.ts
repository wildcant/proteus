import { lingui, linguiTransformerBabelPreset } from '@lingui/vite-plugin'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: {
    proxy: {
      '/static': process.env.VITE_BACKEND_URL ?? 'http://localhost:3000',
    },
  },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    // `.po` imports compile to message modules; `@vitejs/plugin-react` 6 runs no Babel, so the Lingui
    // macros get their own pass.
    lingui({ cwd: import.meta.dirname }),
    babel({ presets: [linguiTransformerBabelPreset({}, { cwd: import.meta.dirname })] }),
  ],
})

export default config
