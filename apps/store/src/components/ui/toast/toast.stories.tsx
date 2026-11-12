import toastSet from '@proteus/design/components/Toast.json'
import { setDefault } from '@proteus/design/figcraft-set'
import { toast } from '@proteus/ui-core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Toaster } from './toast'

const meta = {
  title: 'ui/Toast',
  component: Toaster,
  args: {
    children: (
      <button
        type="button"
        onClick={() =>
          toast.add({
            type: 'error',
            title: setDefault(toastSet, 'title'),
            description:
              setDefault(toastSet, 'hasDescription') === 'true' ? setDefault(toastSet, 'description') : undefined,
          })
        }
      >
        Show toast
      </button>
    ),
  },
} satisfies Meta<typeof Toaster>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
