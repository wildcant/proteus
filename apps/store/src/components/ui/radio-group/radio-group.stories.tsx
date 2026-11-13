import radioGroupItemSet from '@proteus/design/components/RadioGroupItem.json'
import { setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RadioGroupItem } from '#/components/ui/radio-group-item/radio-group-item'
import { RadioGroup } from './radio-group'

// The `RadioGroup` set has no properties of its own: it stacks one item per `checked` state of `RadioGroupItem`.
const items = setOptions(radioGroupItemSet, 'checked')

const meta = {
  title: 'ui/RadioGroup',
  component: RadioGroup,
  args: {
    defaultValue: 'true',
    disabled: false,
    children: items.map((value) => <RadioGroupItem key={value} value={value} aria-label={`checked=${value}`} />),
  },
} satisfies Meta<typeof RadioGroup>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
