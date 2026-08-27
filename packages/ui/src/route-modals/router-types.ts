import '@tanstack/history'

/**
 * `RouteModalProvider.handleSuccess` stamps this on history state so `RouteModalForm`'s blocker
 * lets a successful save navigate without prompting.
 *
 * It is declared beside the components rather than in each app that mounts them: the flag is
 * theirs, and an app that forgot to redeclare it would fail to compile for a reason that has
 * nothing to do with its own code.
 */
declare module '@tanstack/history' {
  interface HistoryState {
    isSubmitSuccessful?: boolean
  }
}
