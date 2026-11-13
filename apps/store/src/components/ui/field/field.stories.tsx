import fieldSet from '@proteus/design/components/Field.json'
import { setDefault, setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Checkbox } from '#/components/ui/checkbox/checkbox'
import { FieldLabel } from '#/components/ui/field-label/field-label'
import { Field } from './field'

const meta = {
  title: 'ui/Field',
  component: Field,
  args: {
    orientation: setDefault(fieldSet, 'orientation') as 'vertical',
    children: [
      <Checkbox key="control" id="field-story" />,
      <FieldLabel key="label" htmlFor="field-story">
        Label
      </FieldLabel>,
    ],
  },
  argTypes: { orientation: { control: 'select', options: setOptions(fieldSet, 'orientation') } },
} satisfies Meta<typeof Field>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
