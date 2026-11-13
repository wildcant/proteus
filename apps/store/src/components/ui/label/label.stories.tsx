import labelSet from '@proteus/design/components/Label.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Label } from './label'

const meta = {
  title: 'ui/Label',
  component: Label,
  args: { children: setDefault(labelSet, 'label') },
  argTypes: { children: { control: 'text' } },
} satisfies Meta<typeof Label>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
