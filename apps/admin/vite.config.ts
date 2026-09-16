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
  plugins: [devtools(), tailwindcss(), tanstackRouter({ target: 'react', autoCodeSplitting: true }), viteReact()],
})

export default config
