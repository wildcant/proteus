import tooltipSet from '@proteus/design/components/Tooltip.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'

function TooltipStory({ label }: { label: string }) {
  return (
    <div className="flex h-60 items-end justify-center">
      <Tooltip defaultOpen>
        <TooltipTrigger className="type-body-compact text-ink">?</TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </div>
  )
}

const meta = {
  title: 'ui/Tooltip',
  component: TooltipStory,
  args: { label: setDefault(tooltipSet, 'label') },
  argTypes: { label: { control: 'text' } },
} satisfies Meta<typeof TooltipStory>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
