import checkboxSet from '@proteus/design/components/Checkbox.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from './checkbox'

const meta = {
  title: 'ui/Checkbox',
  component: Checkbox,
  // The set's `checked` is Base UI's state; the story starts from the set's default.
  args: { defaultChecked: setDefault(checkboxSet, 'checked') === 'true', disabled: false },
} satisfies Meta<typeof Checkbox>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
