import fieldErrorSet from '@proteus/design/components/FieldError.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { FieldError } from './field-error'

const meta = {
  title: 'ui/FieldError',
  component: FieldError,
  args: { children: setDefault(fieldErrorSet, 'message') },
  argTypes: { children: { control: 'text' } },
} satisfies Meta<typeof FieldError>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
