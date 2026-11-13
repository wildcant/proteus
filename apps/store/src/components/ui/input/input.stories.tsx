import inputSet from '@proteus/design/components/Input.json'
import { setDefault, setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Input } from './input'

const meta = {
  title: 'ui/Input',
  component: Input,
  args: {
    defaultValue: setDefault(inputSet, 'value'),
    'aria-invalid': setDefault(inputSet, 'invalid') === 'true',
    disabled: false,
  },
  argTypes: {
    // The set's `invalid` is the input's `aria-invalid`.
    'aria-invalid': { control: 'select', options: setOptions(inputSet, 'invalid').map((value) => value === 'true') },
  },
} satisfies Meta<typeof Input>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
