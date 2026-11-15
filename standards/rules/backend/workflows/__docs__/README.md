# Workflows

`src/workflows/` is where a mutation that spans two modules is orchestrated, together with the
compensation that unwinds it. One domain folder per area, each holding its workflows, the steps they
compose and the pure utils either may call.

| Document | Use case |
|---|---|
| [Workflows](./workflows.md) | **Making several modules change together, atomically.** Use when one action writes across a module boundary and a failure halfway would leave the rest standing. |
| [Hooks](./hooks.md) | **Letting a store change how a core workflow computes something.** Use when defining a hook in a core workflow, or writing an extension's handler for one. |

Deciding whether you need one at all is the last question in
[route helpers](../../api/__docs__/route-helpers.md); the engine that runs them is mechanism and
lives in [`src/framework/workflows/README.md`](../../../../../apps/backend/src/framework/workflows/README.md).
