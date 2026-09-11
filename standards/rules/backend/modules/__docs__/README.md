# Modules

`src/modules/` is the backend's domain layer: one folder per domain, each a private container of
repositories behind exactly one service the rest of the app may resolve.

| Document | Use case |
|---|---|
| [Modules](./modules.md) | **Placing a file, or changing a table.** Use when you are working inside a module that already exists and need to know what may live where. |
| [Adding a module](./adding-a-module.md) | **Standing up a new domain.** Use once per module: the types, the wiring and the migration that make it resolvable. |

The first is read every time someone opens the folder; the second once per module. Someone adding
their first module needs both.
