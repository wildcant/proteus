import dropdownMenuItemSet from '@proteus/design/components/DropdownMenuItem.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DropdownMenuItem } from '../dropdown-menu-item/dropdown-menu-item'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './dropdown-menu'

/** The set draws its items as a slot, so the story fills it with two `DropdownMenuItem`s. */
function DropdownMenuStory({ label }: { label: string }) {
  return (
    <div className="flex h-60 items-end justify-center">
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger className="type-body-compact text-ink">{label}</DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" sideOffset={8}>
          <DropdownMenuItem current>{label}</DropdownMenuItem>
          <DropdownMenuItem>{label}</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

const meta = {
  title: 'ui/DropdownMenu',
  component: DropdownMenuStory,
  args: { label: setDefault(dropdownMenuItemSet, 'label') },
  argTypes: { label: { control: 'text' } },
} satisfies Meta<typeof DropdownMenuStory>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
