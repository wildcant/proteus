# Service contracts

A module service is reached through the container, and the container hands back the contract in
`core/types/<module>/service.ts` rather than the class. So the contract is the module's whole
public surface: what is not on it cannot be called from outside the module, and a second name for
one method is a second thing every caller has to choose between. `docs/container-resolution.md`
covers the read itself; ADR-0001 records why a module exposes a service and nothing else.

## Shape

```ts
// core/types/access-control/service.ts — the contract
export type IAccessControlModuleService = {
  listActorRoles(actorType: string, actorId: string, context?: Context): Promise<RoleDTO[]>
}

// modules/access-control/services/access-control-module-service.ts — the class
export class AccessControlModuleService implements IAccessControlModuleService {
  async listActorRoles(actorType: string, actorId: string, context?: Context): Promise<RoleDTO[]> {
    return this.actorRoleAssignmentRepository.find({ actorType, actorId }, undefined, context)
  }
}

// modules/access-control/index.ts — the registration, which checks the two agree
export default Module(Modules.ACCESS_CONTROL, { service: AccessControlModuleService, ... })
```

## Rules

### Every public method is on the contract

`implements IFooModuleService` checks one direction: every method the contract names exists on the
class. The other direction is the one that rots — a method grows on the class, callers reach it
through the container, and the container hands back a contract that has never heard of it. So
`Module()` computes `Exclude<keyof InstanceType<Service>, keyof ModuleServiceContracts[Key]>` and,
when that is not `never`, demands a third argument no caller can supply. The failure reads
`Expected 3 arguments, but got 2` at the module definition; the missing methods are in the type of
the argument it is asking for.

Two ways out of it, and which one is right is a question about the method: put it on the contract,
or make it `private`. A public method with no caller outside the module is the second case.

### A method does not wrap another method

A method whose entire body forwards its arguments to another method of the same class adds a name
and no behaviour. Both names then need keeping in step, and every caller has to decide which one it
meant. Rename the inner method if the outer name is better.

Forwarding that *binds* an argument is different — it is the decision the method exists to make:

```ts
// Not a wrapper: 'user' is what this method is for.
async listUserRoles(userId: string, context?: Context): Promise<RoleDTO[]> {
  return this.listActorRoles('user', userId, context)
}
```

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `wraps-another-method` | that a method does not forward its arguments to a sibling |

The first claim has no rule: it is checked by `Module()`'s signature, so it fails
`pnpm run typecheck` rather than `pnpm run check:standards`. A rule could not see it — the class
and its contract are different files, and ast-grep matches one file at a time.

### Exemptions

**`**/__tests__/**`.** A fake forwards to its own recorder by design.

## What is deliberately not enforced

- **That a contract method is reachable.** Nothing checks a contract entry has callers; knip sees
  the type as used because the class implements it.
- **Wrapping across objects.** `return provider.cancelPayment(input)` after a line of logging is a
  delegation the service exists to do, and the rule only matches a body that is one `return this.…`
  and nothing else.
- **Naming.** Whether `deleteSession` and `cancelPayment` should be two names for one gateway call
  is a judgement about the domain, not a shape a rule can read.
