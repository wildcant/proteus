import fieldLabelSet from '@proteus/design/components/FieldLabel.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FieldLabel } from './field-label'

const meta = {
  title: 'ui/FieldLabel',
  component: FieldLabel,
  args: { children: setDefault(fieldLabelSet, 'label') },
  argTypes: { children: { control: 'text' } },
} satisfies Meta<typeof FieldLabel>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
