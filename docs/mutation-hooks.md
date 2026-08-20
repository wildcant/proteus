# Mutation Hook Pattern

Mutation hooks in `features/{name}/api/` wrap Orval-generated API functions with React Query's `useMutation`. Every mutation hook follows a consistent pattern: accept an optional `options` parameter, handle cache invalidation on success, display an error toast on failure, and forward all callbacks to the caller.

## Structure

```
features/{name}/
  api/{name}.ts   — query options, query hooks, and mutation hooks
```

## Hook shape

```ts
import { toast } from '@proteus/ui'
import type { UseMutationOptions } from '@tanstack/react-query'
import { useMutation } from '@tanstack/react-query'
import { createThing } from '#/api/generated/things/things'
import type { CreateThingBody, CreateThingResponse } from '#/api/generated/model'
import { queryClient } from '#/lib/query-client'
import { queryKeysFactory } from '#/lib/query-key-factory'

const thingKeys = queryKeysFactory('things')

export const useCreateThing = (options?: UseMutationOptions<CreateThingResponse, Error, CreateThingBody>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: CreateThingBody) => createThing(data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: thingKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to create thing', description: error.message })
      onError?.(...args)
    },
  })
}
```

## Rules

### Options parameter

- Every mutation hook accepts `options?: UseMutationOptions<TData, Error, TVariables>` as its last parameter.
- `TData` is the Orval-generated response type (e.g., `AdminProductResponse`, `DeleteResponse`).
- `TVariables` matches what the caller passes to `.mutate()`. Use `void` when the mutation takes no arguments (e.g., delete hooks where the id is in a closure).
- Destructure `{ onSuccess, onError, ...rest }` from options and spread `...rest` into `useMutation` so callers can set any mutation option (e.g., `retry`, `onSettled`).

### Error toasts

- Every mutation must have an `onError` handler that displays a toast via `toast.add()`.
- Toast shape: `{ type: 'error', title: '...', description: error.message }`.
- Title should be a short, human-readable failure message (e.g., "Failed to create product", "Login failed").
- Always forward to the caller's `onError` after the toast: `onError?.(...args)`.

### Cache invalidation

- Invalidate relevant query keys in `onSuccess`, then forward to the caller's `onSuccess`.
- For create mutations: invalidate list keys (`queryKeys.lists()`).
- For update mutations: invalidate both the detail key and list keys.
- For delete mutations: invalidate list keys (detail cache is stale anyway).

### Hooks with closure parameters

When a hook takes resource identifiers (e.g., `id`, `productId`), they come before the options parameter:

```ts
export const useUpdateThing = (id: string, options?: UseMutationOptions<ThingResponse, Error, UpdateThingBody>) => {
  const { onSuccess, onError, ...rest } = options ?? {}
  return useMutation({
    ...rest,
    mutationFn: (data: UpdateThingBody) => updateThing(id, data),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: thingKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: thingKeys.lists() })
      onSuccess?.(...args)
    },
    onError: (...args) => {
      const [error] = args
      toast.add({ type: 'error', title: 'Failed to update thing', description: error.message })
      onError?.(...args)
    },
  })
}
```

## Relationship with form hooks

Form hooks (`features/{name}/hooks/use-{action}-form.ts`) consume mutation hooks. The form hook calls `.mutate()` with per-call callbacks, while the mutation hook provides the default error toast. See `docs/form-hooks.md` for the form layer pattern.
