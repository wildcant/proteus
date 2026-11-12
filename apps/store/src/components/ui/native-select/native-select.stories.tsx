import nativeSelectSet from '@proteus/design/components/NativeSelect.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { NativeSelect, NativeSelectOption } from './native-select'

const value = setDefault(nativeSelectSet, 'value')

const meta = {
  title: 'ui/NativeSelect',
  component: NativeSelect,
  args: {
    defaultValue: value,
    disabled: false,
    children: [value, 'Another option'].map((option) => (
      <NativeSelectOption key={option} value={option}>
        {option}
      </NativeSelectOption>
    )),
  },
} satisfies Meta<typeof NativeSelect>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
