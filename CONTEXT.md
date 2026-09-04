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
A variant's display name: its Option Combination's values joined in the product's option order
(`"M / White"`), or the product's title when the product offers no options. Always derived, never
written by hand — a title that could disagree with the combination is a title that will. Copied
onto cart line items and order items when a shopper adds to cart, so it is what they see in their
order history for good.
_Avoid_: variant name, variant label

**Variant Reconciliation Plan**:
What a proposed set of Product-Scoped Options would do to a product's variants — which survive
untouched, which are reassigned, which are created and which are deleted. Shown to the admin
before it is applied, and computed the same way for a product that has no variants yet as for one
that already sells.
_Avoid_: diff, migration, matrix update

**Reassignment**:
Moving a variant onto a different Option Combination, whether the admin picks the new one or a
Variant Reconciliation Plan derives it. A variant's identity — its SKU, price, images and order
history — survives a reassignment; only which combination it stands for changes.
_Avoid_: move, remap, re-link

### Markets

**Region**:
A set of countries the store sells to under one currency — the currency every price inside it is
written in and every payment inside it settles in. A country belongs to at most one Region, and
giving it one is what makes it sellable at all. A shopper never names a Region; they name a
country, and the store resolves the Region behind it.
_Avoid_: zone, territory, market, currency zone

**Market**:
One country a shopper can shop in, as the storefront offers it: the country, the Locale it is read
and formatted in, and the name the market control lists it under. Every Market belongs to a Region,
so choosing one also chooses the currency prices are quoted in, the payment methods offered and the
country deliveries are priced to. The Markets are exactly the countries the store sells to — a
Region is how the store groups them, a Market is how a shopper picks one.
_Avoid_: region, locale (for the country), storefront region, country picker

### Storefront language

**Locale**:
A BCP 47 tag naming both the language the storefront renders Store Copy in and the regional
conventions it formats numbers and dates with — `es-US` is Spanish words with US number and date
conventions. Each Market carries exactly one, which is what identifies it in the URL and what every
number and date formatter is handed. A Locale selects no prices of its own; it arrives attached to
a Market, and it is that Market's Region that decides the currency, so two Locales are not two
readings of one catalogue at one price.
_Avoid_: market, region, language (as a system concept), i18n

**Message Catalog**:
The Store Copy translations for one language, keyed by the language subtag alone — `es-US` and
`es-MX` share one. Distinct from the product catalogue, which is merchandise; a Message Catalog
holds no merchandise and the catalogue holds no translations.
_Avoid_: catalog (unqualified), translations, locale file

**Store Copy**:
Text the storefront itself authors — labels, headings, button text, validation messages, its own
toast titles. The only text a Locale can change.
_Avoid_: content, strings, UI text

**Merchant Text**:
Text that reaches the shopper from the backend — product titles and descriptions, Product Option
titles and values, Variant Titles, shipping option names, payment provider labels, API error
messages. The storefront cannot translate it; only the backend that owns it can.
_Avoid_: catalogue copy, dynamic content, server strings
