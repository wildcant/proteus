# Data hooks

A data hook assembles everything one page reads. It calls the
[query hooks](../../api/__docs__/query-hooks.md) that page needs, derives from them what the page
actually wants, and returns it as a single object the page passes down.

Letting each component fetch its own data instead gives you a request waterfall and several
unrelated loading states, and leaves nowhere to put the derivation two of those components both
need.

## Structure

```
features/{name}/
  hooks/use-{page}-data.ts   — the page's reads, in one place
```

## Shape

```ts
export type CheckoutDataParams = {
  cart: StoreCartDetailResponseCart
}

export function useCheckoutData({ cart }: CheckoutDataParams) {
  const { addresses: savedAddresses, isLoading: isAddressesLoading } = useAddresses()
  const { customer } = useMe()
  const { current } = useMarket()

  const addresses = useMemo(
    () => savedAddresses.filter((address) => address.countryCode?.toLowerCase() === current.iso2),
    [savedAddresses, current.iso2],
  )

  return { cart, customer, addresses, isAddressesLoading }
}

export type CheckoutData = ReturnType<typeof useCheckoutData>
```

## Rules

### One hook per page, and it only reads

It composes query hooks. A write belongs to the [form hook](./form-hooks.md) that submits it, or to
the component whose control triggers it — a data hook that also mutates is two responsibilities in
one return value, and callers can no longer tell which half a re-render came from.

Like every hook outside `features/{name}/api/`, it calls query hooks rather than the generated API
client.

### It exports its own return type

```ts
export type CheckoutData = ReturnType<typeof useCheckoutData>
```

This is the point of the shape. `useCheckoutForm` takes `data: CheckoutData` as a parameter and
every checkout section takes the same object, so the page has one description of what it is showing
rather than one per component. Derive the type from the function rather than declaring it by hand:
the two cannot then disagree.

### What the route already fetched comes in as a parameter

`cart` above is loaded by the route, so the hook takes it rather than reading it a second time. A
data hook is where a page's reads are *collected*, not a second place they happen.

### Derivation lives here, not in the components

`useCheckoutData` narrows the address book to the addresses the current market delivers to, and
builds the cart-shaped version of each. Both are decisions about what this page means, and doing
them here means every section agrees. A component that re-derives the same thing from raw query
output is how two surfaces come to disagree about the same data.

### Page state shared by several components may live here

`useCheckoutData` holds the selected payment provider, because more than one section reads it and it
belongs next to the data it is about. Anything only one component uses stays in that component.

## Enforcement

No ast-grep rule governs data hooks yet — these conventions are held by review. If one hardens into
a shape worth checking, the rule goes in `rules/frontend/features/hooks/` and its id gets a row here.

## Relationship with query hooks

A data hook is a consumer, not a replacement: the query still belongs to an exported
`*QueryOptions` factory in `features/{name}/api/`, so a route loader can prefetch the same query
this hook reads. See [query hooks](../../api/__docs__/query-hooks.md).

## Relationship with form hooks

A page that both reads and writes has one of each. The data hook gathers what the form needs and the
form hook takes it as a parameter — which is also why a form hook contains no queries of its own.
See [form hooks](./form-hooks.md).
