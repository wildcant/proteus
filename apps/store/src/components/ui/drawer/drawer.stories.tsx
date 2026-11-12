import { Drawer as DrawerPrimitive } from '@base-ui/react/drawer'
import drawerSet from '@proteus/design/components/Drawer.json'
import drawerTitleSet from '@proteus/design/components/DrawerTitle.json'
import { setDefault, setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Drawer, DrawerClose, DrawerContent, DrawerTitle } from './drawer'

// The set's `side` is the edge the drawer slides from, Base UI's `swipeDirection`.
type Side = 'right' | 'left' | 'up'

const meta = {
  title: 'ui/Drawer',
  component: Drawer,
  args: {
    swipeDirection: setDefault(drawerSet, 'side') as Side,
    children: [
      <DrawerPrimitive.Trigger key="trigger">Open drawer</DrawerPrimitive.Trigger>,
      <DrawerContent key="content">
        <DrawerTitle>{setDefault(drawerTitleSet, 'label')}</DrawerTitle>
        <DrawerClose>Close</DrawerClose>
      </DrawerContent>,
    ],
  },
  argTypes: { swipeDirection: { control: 'select', options: setOptions(drawerSet, 'side') } },
} satisfies Meta<typeof Drawer>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
