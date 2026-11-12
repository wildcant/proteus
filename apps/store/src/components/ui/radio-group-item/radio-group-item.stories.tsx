import radioGroupItemSet from '@proteus/design/components/RadioGroupItem.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { RadioGroup } from '#/components/ui/radio-group/radio-group'
import { RadioGroupItem } from './radio-group-item'

const meta = {
  title: 'ui/RadioGroupItem',
  component: RadioGroupItem,
  args: { value: 'item', disabled: false, 'aria-label': 'Item' },
  // A radio only renders inside its group; the set's `checked` default decides whether it starts chosen.
  decorators: [
    (Story) => (
      <RadioGroup defaultValue={setDefault(radioGroupItemSet, 'checked') === 'true' ? 'item' : undefined}>
        <Story />
      </RadioGroup>
    ),
  ],
} satisfies Meta<typeof RadioGroupItem>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
