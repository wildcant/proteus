# Proteus

An e-commerce platform: a catalogue of products, the variants shoppers actually buy, and the
carts, orders and payments that follow. This glossary fixes the words the codebase uses so the
same concept is not called three things in three layers.

## Language

### Product options

**Product Option**:
A globally-defined dimension a product can vary along, such as Size or Color. Owns its full set of
values and is shared across products.
_Avoid_: attribute, spec, property

**Product Option Value**:
One value belonging to a Product Option, such as `M` or `Black`.
_Avoid_: option, variant option

**Product-Scoped Option**:
A Product Option as one particular product offers it — the option, the subset of its values that
product sells, and that product's display order for it. A global Color may hold Red/Blue/Green
while a product's Product-Scoped Option offers only Red/Blue. Distinct from the Product Option
itself, which every product shares.
_Avoid_: product option (unqualified), option with values

### Variants

**Option Combination**:
The set of option values that identifies a Product Variant — exactly one Product Option Value for
each Product-Scoped Option the product offers. Two variants of the same product can never share
one.
_Avoid_: tuple, option map, selection, selected values

**Available Combination**:
An Option Combination a product could sell but has no variant for yet. What the admin may still
create; the complement of the combinations already taken.
_Avoid_: free combination, unused combination, matrix row

**Variant Title**:
A variant's display name, defaulting to its Option Combination's values joined in the product's
option order (`"M / White"`) and overridable per variant. Copied onto cart line items and order
items when a shopper adds to cart, so it is what they see in their order history for good.
_Avoid_: variant name, variant label
