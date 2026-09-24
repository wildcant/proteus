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

### Product grouping

**Category**:
A node in the merchant's tree that says what a product is and who it is for — `Women › Bracelets`.
Shoppers browse by it, and it changes rarely. A product can sit in several Categories, such as a
unisex hoodie under both Men and Women.
_Avoid_: department, section, menu item, taxonomy (reserve that for an external standard tree)

**Visible Category**:
A Category a shopper can see: active, not internal, and every ancestor visible too. A hidden
Category hides its whole subtree.
_Avoid_: public category, published category

**Collection**:
A flat, hand-picked group of products around a season, campaign or story, with its own landing
page — `Summer 2026`, `Gifts under $200`. Says nothing about what the product is, so Collections
overlap: a product can sit in several. Its membership is stored and chosen by a person; a list
derived from data is a Computed List, never a Collection.
_Avoid_: category, curated shop, edit, lookbook, range, assortment

**Computed List**:
A product list whose membership and order are derived from data each time it is read, never stored
or hand-picked — New Arrivals (newest first), Best Sellers (most units sold), Trending Now (most
units sold recently). It can be narrowed to a Category, Collection or Tag — Women's New Arrivals —
but no product is ever added to or removed from it by hand; changing what it shows means changing
its rule.
_Avoid_: collection, smart collection, automated collection, featured category, sort (for the list
itself)

**Tag**:
A free, flat keyword on a product — `organic-cotton`, `gold` — used for filtering, search and rule
matching. Many per product, no hierarchy, no page of its own.
_Avoid_: label, keyword, attribute, facet

**Product Type**:
The one optional label that names what a product is — `T-shirt`, `Hoodie`, `Sneakers`. Admin-facing,
used for grouping and as a key in tax and promotion rules. Defines neither attributes nor behaviour:
whether a product ships or is a gift card is not its Product Type.
_Avoid_: kind, category, template, attribute set, physical/digital

**Navigation Menu**:
The storefront's header and side menu: links to Categories, Collections, Tag-filtered lists and
Computed Lists, under headings that are Store Copy — "Featured" is a heading over Computed Lists,
not a Category. Not itself a grouping of products.
_Avoid_: category tree, mega menu (for the data)

### Inventory

**Stock Location**:
A place the shop holds stock. The shop keeps exactly one, but nothing about the concept is
singular — an Inventory Level and a Reservation each name the location they belong to, so a second
one adds rows rather than changing what the words mean.
_Avoid_: warehouse, fulfillment center, site, stock room

**Inventory Item**:
The stock-keeping identity a Product Variant is linked to — the thing quantities are counted
against. Not the variant itself: the variant is what a shopper buys and prices, the Inventory Item
is what the shop counts and ships.
_Avoid_: stock item, inventory record, SKU (as an entity), variant (for the thing counted)

**Inventory Level**:
One Inventory Item's quantities at one Stock Location — its Stocked Quantity and everything
reserved against it there. An Inventory Item has one Level per location it is stocked at, and a
location it has no Level at is a location it cannot be reserved or shipped from.
_Avoid_: stock level, inventory (for the row), quantity row, stock record

**Reservation**:
Quantity of an Inventory Item committed to one of an order's line items and not yet shipped. It is
written when the order is placed, released when the order is cancelled, and turned into a deduction
from Stocked Quantity when the order is fulfilled.
_Avoid_: allocation, hold, commitment, committed stock

**Stocked Quantity**:
What is physically on the shelf at one Stock Location, including the units already committed to
orders by a Reservation. It moves only when stock physically moves or a shopkeeper corrects the
count — placing an order never lowers it.
_Avoid_: on hand, physical stock, total stock, inventory quantity

**Available Quantity**:
Stocked Quantity at a Stock Location minus everything reserved there: what a shopper can still buy.
The two are the pair most often confused — Stocked is the shelf, Available is the shelf less the
orders already promised from it — and it is Available that decides sold out, low stock and whether
a cart can be completed.
_Avoid_: stock, in stock, remaining stock, free quantity, stocked quantity

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
One workspace's translations for one language — the storefront's Store Copy, the backend's API
Messages, or the shared schemas' validation messages — keyed by the language subtag alone: `es-CO`
and `es-MX` share one. Distinct from the product catalogue, which is merchandise; a Message Catalog
holds no merchandise and the catalogue holds no translations.
_Avoid_: catalog (unqualified), translations, locale file

**Store Copy**:
Text the storefront itself authors — labels, headings, button text, its own toast titles. Translated
in the storefront's Message Catalog.
_Avoid_: content, strings, UI text

**Merchant Text**:
Text that reaches the shopper from the backend — product titles and descriptions, Product Option
titles and values, Variant Titles, shipping option names, payment provider labels, API Messages.
The storefront cannot translate it; only the backend that owns it can.
_Avoid_: catalogue copy, dynamic content, server strings

**API Message**:
The message of an error the backend returns, including validation messages from shared schemas. The
one kind of Merchant Text the backend translates from its own Message Catalog, by the request's
Locale, rather than from translation rows.
_Avoid_: error string, server error text

### Access control

**Feature**:
A capability a module registers at startup — a string key and a human-readable title. Features are
the unit of permission the system knows about. A module owns its features the way it owns its tables;
no other module may register the same key.
_Avoid_: permission (for the registration side), capability, privilege, entitlement

**Permission Key**:
The `model.action` string that identifies a Feature — `product.read`, `order.cancel`,
`user.invite.create`. Sub-models nest with an extra dot segment. A Permission Key is always concrete:
it names exactly one action on one model, never a wildcard.
_Avoid_: permission string, scope, access key, ACL entry

**Permission Grant**:
What a Role stores: a Permission Key, a module wildcard (`product.*`), or the global wildcard
(`'*'`). A Grant is what the admin picks; it may be broader than a single Permission Key. The
authorization engine expands grants to concrete keys at check time.
_Avoid_: permission (unqualified when the distinction matters), entitlement, access level

**Role**:
A named set of Permission Grants that can be assigned to actors. Roles compose by union — an actor
with two Roles holds the union of both grant sets. There is no hierarchy, no inheritance, and no deny
rules. A protected Role cannot be deleted; the super admin Role is also immutable.
_Avoid_: access level, permission group, profile, tier

**Super Admin**:
The one Role whose grant set is `['*']` — the global wildcard that matches every Permission Key
without enumeration. It is not a special code path; the engine treats `'*'` as a grant like any
other, and `matchFeature` returns true for every requirement. Immutable through the admin API.
_Avoid_: root, god mode, admin (unqualified)

**Actor Role Assignment**:
The record that binds an actor (identified by type and id) to a Role. Polymorphic: `actor_type`
discriminates the kind of actor (`'user'` in Phase 1), and `actor_id` is an opaque reference to
that actor's id. Lives inside the access-control module, not as a link module.
_Avoid_: user role, role membership, role binding, ACL

**Authorization Actor**:
The identity carried on request context that the authorization engine evaluates — the actor's id,
type, granted features, and whether it is unrestricted. Built from the session's auth context by
middleware and threaded through service calls on the `Context` object.
_Avoid_: current user, auth user, session user, principal

**Effective Features**:
The concrete Permission Keys an actor actually holds after all wildcard grants are expanded against
the registered Feature catalogue. What the server sends to the frontend as `allowedActions`. Contains
no wildcards — every entry is a Permission Key the client can match with exact string comparison.
_Avoid_: resolved permissions, expanded grants, active permissions
