import type { Meta, StoryObj } from '@storybook/react-vite'
import { Icon } from './icon'
import { glyphs, type IconName } from './icon.glyphs'

// The Icon set exports SVGs, not a component snapshot, so its variant names are the generated glyphs' keys.
const names = Object.keys(glyphs) as IconName[]

const meta = {
  title: 'ui/Icon',
  component: Icon,
  args: { name: 'check' },
  argTypes: {
    name: { control: 'select', options: names },
    size: { control: 'number' },
    strokeWidth: { control: 'number' },
  },
} satisfies Meta<typeof Icon>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const AllGlyphs: Story = {
  render: (args) => (
    <ul className="grid grid-cols-5 gap-6 text-ink">
      {names.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2">
          <Icon {...args} name={name} />
          <span className="text-ink-muted text-xs">{name}</span>
        </li>
      ))}
    </ul>
  ),
}
