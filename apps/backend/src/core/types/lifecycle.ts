export type ApplicationLifecycle = {
  onApplicationStart(): Promise<void>
  onApplicationPrepareShutdown(): Promise<void>
  onApplicationShutdown(): Promise<void>
}
