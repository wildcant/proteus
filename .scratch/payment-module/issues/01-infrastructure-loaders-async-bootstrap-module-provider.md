# 01 — Infrastructure: Loaders, async bootstrap, and ModuleProvider utility

**What to build:** Extend the module system so that modules can declare loaders (functions that run during bootstrap) and receive options. `bootstrapModule` becomes async and accepts a generic options parameter. A new `ModuleProvider()` utility lets provider packages declare themselves. All existing modules continue to boot correctly after the change.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `ModuleDefinition` gains an optional `loaders` field (array of loader functions)
- [ ] `LoaderFunction<TOptions>` type defined — receives `{ container, options }` and returns `void | Promise<void>`
- [ ] `bootstrapModule` becomes `async bootstrapModule<TOptions>(container, moduleDefinition, options?)` — runs loaders after registering repositories and service
- [ ] `ModuleProvider(moduleName, { services })` utility created in `core/utils/` — returns a descriptor that `bootstrapModule` options can reference
- [ ] All call sites in `container.ts` updated to `await bootstrapModule(...)` (top-level await or async IIFE)
- [ ] Existing modules (user, customer, cart, inventory, product) still boot and work correctly
- [ ] Type-checks pass (`pnpm --filter backend run typecheck`)
