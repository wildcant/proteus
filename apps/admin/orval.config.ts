import { defineConfig } from 'orval'

export default defineConfig({
  admin: {
    input: {
      target: '../backend/openapi/openapi-admin.json',
    },
    output: {
      target: 'src/api/generated',
      schemas: 'src/api/generated/model',
      client: 'axios-functions',
      mode: 'tags-split',
      clean: true,
      override: {
        mutator: {
          path: './src/api/fetcher.ts',
          name: 'fetcher',
        },
      },
    },
  },
})
