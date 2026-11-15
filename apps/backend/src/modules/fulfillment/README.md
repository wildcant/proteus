# Fulfillment module

The fulfillment module decides where the shop delivers and what delivery costs, and records what it
shipped. It holds fulfillment sets and their service zones, the geo zones that say which addresses a
service zone serves, shipping profiles, shipping options and their types, fulfillments, and the
fulfillment providers that price and carry out shipping. It knows nothing about Carts or Orders:
workflows hand it an address and items, and store the shipping method on the Cart or Order
themselves.

## Providers

A provider implements the fulfillment provider port (`core/types/fulfillment/provider.ts`) by
extending `AbstractFulfillmentProvider`. It is registered into the module's private container under
`fp_<identifier>_<id>` and has a row in `fulfillment_provider`. Three sources feed the same list:

- the manual provider (`providers/manual.ts`, `fp_manual_default`), always registered, which prices
  nothing and ships by hand;
- core's declarations in `provider-declarations.ts`;
- every extension's fulfillment provider declarations, read from the extension registry and merged
  after core's when the module bootstraps.

On Node the module's loader upserts the rows at boot. workerd skips that, so
`scripts/seed-providers.ts`, through `sync-providers.ts`, writes the same list, extensions' providers
included, before a deploy. An extension's provider resolves the services it needs from the shared
container at construction, its own extension's modules included, and never a core module's
internals. How a fork adds one is the
[fulfillment provider checklist](../../../../../standards/rules/backend/extensions/__docs__/extensions.md#a-fulfillment-provider).

## Which options serve an address

A shipping option belongs to a service zone, and a service zone serves an address when **any** of
its geo zones matches it, as in Medusa:

| Geo zone type | Matches when the address has the same |
|---|---|
| `country` | country |
| `province` | country and province |
| `city` | country, province and city |
| `zip` | country, province, city and postal code |

Country codes compare exactly. Province, city and postal code compare trimmed and case-insensitively,
so `Medellín ` and `medellín` are one city. An address missing a field a zone needs doesn't match
that zone.

## Flat and calculated prices

A shipping option's price type is `flat` or `calculated`.

- **Flat**: the price comes from the option's price set, priced in the Cart's Region like any
  other price.
- **Calculated**: the option's provider prices it, for this Cart, each time the Cart's options are
  listed. The Cart's shipping-options read returns each option's price type and, for a calculated
  one, its amount.

### The `calculatePrice` contract

The module calls the provider through its provider service:

```ts
calculatePrice(optionData, data, context) → { calculatedAmount, isCalculatedPriceTaxInclusive }
```

- `optionData` is the shipping option's `data`, set when the admin created the option.
- `data` is the shipping method's `data`, empty when the options are only being listed.
- `context` is the Cart: its id, its items with each variant's weight and dimensions, and its
  shipping address.

The amount is in the Cart's currency, in the same units as every other amount. A provider that
can't price this address or these items (a city the courier doesn't reach, a parcel over its
limit) throws the typed "can't calculate" error the port declares. The module leaves that option
out of the list rather than failing the request, so a Cart whose address no option reaches answers
an empty list.

### The shipping method keeps what the price was based on

Setting a shipping method on a Cart validates the option against the Cart's address (it must still
be one the list would return), calls the provider's `validateFulfillmentData`, and stores the
calculated amount as the method's `amount` and that result as its `data`. The price always comes
from the provider, never from the request. Cart totals include the stored amount. A
provider keeps anything it needs later there, a delivery estimate included; there is no core column
for one.

### Refreshing when the Cart changes

When a Cart's items or shipping address change, the Cart workflows refresh its shipping methods, as
Medusa's `refreshCartShippingMethodsWorkflow` does: a calculated method is re-priced, and a method
whose option no longer serves the address, or that its provider can no longer price, is removed.
Completing a Cart and creating a Draft Order copy the method as stored, amount and `data` together.
On a Draft Order, an item or address edit re-prices a calculated method the same way, unless the
admin set a custom amount.
