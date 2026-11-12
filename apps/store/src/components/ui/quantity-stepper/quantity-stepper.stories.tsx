import quantityStepperSet from '@proteus/design/components/QuantityStepper.json'
import { setDefault, setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState } from 'react'
import { QuantityStepper } from './quantity-stepper'

function QuantityStepperStory({ size, value }: { size: 'xs' | 'lg'; value: number }) {
  const [quantity, setQuantity] = useState(value)

  return <QuantityStepper size={size} label="Sport Shorts" value={quantity} onChange={setQuantity} min={1} max={10} />
}

const meta = {
  title: 'ui/QuantityStepper',
  component: QuantityStepperStory,
  args: {
    size: setDefault(quantityStepperSet, 'size') as 'xs',
    value: Number(setDefault(quantityStepperSet, 'value')),
  },
  argTypes: { size: { control: 'select', options: setOptions(quantityStepperSet, 'size') } },
} satisfies Meta<typeof QuantityStepperStory>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
