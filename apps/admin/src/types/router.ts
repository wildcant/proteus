import type { MessageDescriptor } from '@lingui/core'
import '@tanstack/react-router'

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging requires interface
  interface StaticDataRouteOption {
    /** Marked with `msg`, translated when the trail renders: static data is built once, at import. */
    breadcrumb?: MessageDescriptor
  }
}
