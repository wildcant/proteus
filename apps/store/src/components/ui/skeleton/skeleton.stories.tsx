import type { Meta, StoryObj } from '@storybook/react-vite'
import { Skeleton } from './skeleton'

// The `Skeleton` set has no properties: its size is the caller's layout.
const meta = {
  title: 'ui/Skeleton',
  component: Skeleton,
  args: { className: 'h-4 w-48' },
} satisfies Meta<typeof Skeleton>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
