// `.po` files are compiled to modules by `@lingui/vite-plugin`; this lets their dynamic imports typecheck.
declare module '*.po' {
  import type { Messages } from '@lingui/core'

  export const messages: Messages
}
