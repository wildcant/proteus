# Container resolution

Reading a service off the container happens in routes, workflows, subscribers and HTTP
middleware, so the contract belongs to none of them. Two claims, both checked: what you pass as the
key, and what you type the result as. `src/core/README.md` describes what the container holds and
how a port is wired; ADR-0001 records the per-module container isolation this sits on top of.

## Shape

```ts
import { Modules } from '../../../core/utils/modules-definition.js'

// An IAccessControlModuleService, because that is what the key maps to.
const accessControlService = req.scope.resolve(Modules.ACCESS_CONTROL)
```

## Rules

### The key is a `Modules` or `ContainerRegistrationKeys` member

`Modules` (`core/utils/modules-definition.ts`) names every module service in the shared container;
`ContainerRegistrationKeys` (`core/utils/container.ts`) names everything else — the logger, the
event bus, the link service, the db provider. A literal spells the key a second time, so renaming
the registration leaves the read behind and the break arrives at runtime as
`AwilixResolutionError`, not at `pnpm run typecheck`. A `const` alias of the same literal is the
same duplicate with a name on it.

Both enums are `as const`, so passing a member also narrows what the container is asked for.

### The key carries the type, so no call site names one

`core/types/container.ts` maps each key to what the container returns for it —
`ModuleServiceContracts` for the `Modules` members, `CoreRegistrationContracts` for the
`ContainerRegistrationKeys` ones — and `AppContainer` applies that mapping to `resolve`. So
`resolve(Modules.ORDER)` is an `IOrderModuleService` with nothing written down, and asking for a
method the order service does not have is a type error at the call site.

Naming the type by hand is not an override of that mapping, it is a type error: the type argument
*is* the key, so `resolve<IOrderModuleService>(Modules.PRODUCT)` does not compile. That is the
whole reason the mapping is worth having — a structural type listing the two methods a caller
happens to use, or another module's contract entirely, cannot be smuggled past it.

A module's private container is the one place that needs the older, looser read: its repositories
and provider instances sit under computed string keys `core/` has never seen. That container is
`ModuleContainer`, which keeps both signatures. Which type a parameter has is therefore the whole
statement about which container it is.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `resolves-an-unlisted-container-key` | that the key is a `Modules` or `ContainerRegistrationKeys` member |

The rule matches the `.resolve()` call on any receiver whose name ends in `container`, `scope` or
`cradle`, which is what separates a container read from `path.resolve` and `Promise.resolve`.

The second claim has no rule behind it. `AppContainer.resolve` takes its type argument as the key,
so a hand-written type fails `pnpm run typecheck` — there is nothing left for a rule to catch.

### Exemptions

Two paths, both holding a `ModuleContainer`, and both as narrow as the shape that earns them. The
rest of `src/modules/` is checked like everything else.

**`src/modules/*/services/*-provider-service.ts`.** These resolve a key computed at runtime from a
provider id — `payment-provider-service.ts` resolves `providerId`, `notification-provider-service.ts`
a prefixed template — which no enum can list.

**`src/modules/*/loaders/*.ts`.** A loader reads the repositories it is about to hand to a service
out of keys that exist only inside that module. Shared keys read off `ContainerRegistrationKeys`
here like anywhere else — the three `loaders/providers.ts` resolve `ContainerRegistrationKeys.LOGGER`.

**`**/__tests__/**`.** Tests register throwaway keys into containers they build themselves, and
read them back through a `ModuleContainer`.

## What is deliberately not enforced

- **That the mapping matches what the container was actually registered with.**
  `core/types/container.ts` is written by hand against `src/container.ts` and each module
  definition. Nothing checks the two agree; an entry that lies produces a service typed as
  something it is not, and the first call to a method it does not have is where you find out.
- **String-keyed reads inside a module.** `ModuleContainer`'s second signature takes any string and
  returns what the caller asks for, which is what a private container needs and also what makes
  those two exempt paths exempt. Nothing checks that such a key was ever registered.

## Relationship with service contracts

The mapping is only as good as the contracts it points at: a public method a module service never
declared in `core/types/<module>/service.ts` is a method no caller can reach through the container.
`Module()` checks that, and `docs/service-contracts.md` holds the argument.
