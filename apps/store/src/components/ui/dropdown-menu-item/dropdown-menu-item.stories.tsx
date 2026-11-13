import dropdownMenuItemSet from '@proteus/design/components/DropdownMenuItem.json'
import { setDefault, setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '../dropdown-menu/dropdown-menu'
import { DropdownMenuItem } from './dropdown-menu-item'

/** An item needs its menu around it; `highlighted` is Base UI's, so hover or arrow onto the row to see it. */
function DropdownMenuItemStory({ current, label }: { current: boolean; label: string }) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger className="type-body-compact text-ink">Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem current={current}>{label}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const meta = {
  title: 'ui/DropdownMenuItem',
  component: DropdownMenuItemStory,
  args: {
    current: setDefault(dropdownMenuItemSet, 'current') === 'true',
    label: setDefault(dropdownMenuItemSet, 'label'),
  },
  argTypes: {
    current: {
      control: 'select',
      options: setOptions(dropdownMenuItemSet, 'current').map((value) => value === 'true'),
    },
    label: { control: 'text' },
  },
} satisfies Meta<typeof DropdownMenuItemStory>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
