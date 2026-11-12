import routeDrawerSet from '@proteus/design/components/RouteDrawer.json'
import { setDefault } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { RouteDrawer } from './route-drawer'

const meta = {
  title: 'ui/RouteDrawer',
  component: RouteDrawer,
  args: {
    prev: '/',
    children: [
      <RouteDrawer.Header key="header">
        <RouteDrawer.Title>{setDefault(routeDrawerSet, 'title')}</RouteDrawer.Title>
      </RouteDrawer.Header>,
      <RouteDrawer.Body key="body">Body</RouteDrawer.Body>,
      <RouteDrawer.Footer key="footer">
        <RouteDrawer.Close>Cancel</RouteDrawer.Close>
      </RouteDrawer.Footer>,
    ],
  },
  // The drawer's open state is the route, so it renders inside a router of its own.
  decorators: [
    (Story) => (
      <RouterProvider
        router={createRouter({ routeTree: createRootRoute({ component: Story }), history: createMemoryHistory() })}
      />
    ),
  ],
} satisfies Meta<typeof RouteDrawer>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
