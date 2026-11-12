import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  framework: {
    name: '@storybook/react-vite',
    // The app's own vite config builds a Cloudflare Worker with TanStack Start; stories need only React and
    // Tailwind, so they get a config of their own.
    options: { builder: { viteConfigPath: '.storybook/vite.config.ts' } },
  },
  stories: ['../src/**/*.stories.tsx'],
}

// biome-ignore lint/style/noDefaultExport: Storybook reads the config from the default export.
export default config
