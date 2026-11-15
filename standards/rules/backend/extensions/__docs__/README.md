# Extensions

`src/extensions/` is where a store built from Proteus keeps its own backend code: one folder per
extension, holding that store's modules, routes, workflows, hook handlers, subscribers, jobs, seeds,
schemas, catalog and types. Proteus ships the folder empty.

| Document | Use case |
|---|---|
| [Extensions](./extensions.md) | **Adding a backend feature to a fork without editing a Proteus file.** Use for the layout, the name prefixes, and the steps for each kind of file an extension holds. |

Each kind of file then follows its core document, through that document's "In an extension" section:
[adding a module](../../modules/__docs__/adding-a-module.md#in-an-extension),
[routes](../../api/__docs__/routes.md#in-an-extension),
[workflows](../../workflows/__docs__/workflows.md#in-an-extension),
[events](../../subscribers/__docs__/events.md#in-an-extension) and
[hooks](../../workflows/__docs__/hooks.md).
