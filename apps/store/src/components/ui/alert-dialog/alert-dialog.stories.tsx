import alertDialogSet from '@proteus/design/components/AlertDialog.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './alert-dialog'

// The parts as the store's prompt (`usePrompt`) composes them, with the set's text.
const meta = {
  title: 'ui/AlertDialog',
  component: AlertDialog,
  args: {
    defaultOpen: true,
    children: (
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{setDefault(alertDialogSet, 'title')}</AlertDialogTitle>
          <AlertDialogDescription>{setDefault(alertDialogSet, 'description')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{setDefault(alertDialogSet, 'cancelText')}</AlertDialogCancel>
          <AlertDialogAction>{setDefault(alertDialogSet, 'confirmText')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    ),
  },
} satisfies Meta<typeof AlertDialog>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
