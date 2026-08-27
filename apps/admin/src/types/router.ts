import '@tanstack/react-router'

declare module '@tanstack/react-router' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: declaration merging requires interface
  interface StaticDataRouteOption {
    breadcrumb?: string
  }
}
