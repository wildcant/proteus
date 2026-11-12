import buttonSet from '@proteus/design/components/Button.json'
import { setDefault, setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from './button'

const meta = {
  title: 'ui/Button',
  component: Button,
  args: {
    children: setDefault(buttonSet, 'label'),
    variant: setDefault(buttonSet, 'variant') as 'default',
    size: setDefault(buttonSet, 'size') as 'default',
    disabled: false,
  },
  argTypes: {
    variant: { control: 'select', options: setOptions(buttonSet, 'variant') },
    size: { control: 'select', options: setOptions(buttonSet, 'size') },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Button>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
