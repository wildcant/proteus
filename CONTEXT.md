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
A flat group of products around a season, campaign or story, with its own landing page —
`Summer 2026`, `Gifts under $200`. Says nothing about what the product is, so Collections overlap: a
product can sit in several. Its membership is stored, and chosen by a person or by a Rule; a
list derived from sales or dates each time it is read is a Computed List, never a Collection.
_Avoid_: category, curated shop, edit, lookbook, range, assortment

**Computed List**:
A product list whose membership and order are derived from data each time it is read, never stored
or hand-picked — New Arrivals (newest first), Best Sellers (most units sold), Trending Now (most
units sold recently). It can be narrowed to a Category, Collection or Tag — Women's New Arrivals —
but no product is ever added to or removed from it by hand; changing what it shows means changing
its rule.
_Avoid_: collection, smart collection, automated collection, featured category, sort (for the list
itself)

**Rule**:
The condition that decides a Category's or Collection's members from product Metafields: one
condition per Metafield, all of which must hold, each met by any one of its values —
`genero: [hombre, unisex]` and `estilo: [clasicos]`. A ruled grouping's members follow the rule and
cannot be picked by hand; a grouping without one is manual. Membership is stored, and recomputed
whenever a product's Metafields, the rule or a Metafield definition changes.
_Avoid_: tag rule, smart collection, automated collection, filter, condition set

**Metafield**:
A named product field defined once for the store — `Género`, `Tipo`, `Colecciones` — holding a list
of short text values per product. Rules place products by them, and they are what the storefront
filters by. The store structure file defines them; the product CSV fills them in a
`Name (product.metafields.custom.<key>)` column, one value per line.
_Avoid_: attribute, custom field, metadata, property, facet (for the field itself)

**Tag**:
A free, flat keyword on a product — `organic-cotton`, `gold` — used for search and the plain tag
filter. Many per product, no hierarchy, no page of its own, and never read by a Rule.
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

### Commerce

**Cart**:
What a shopper is collecting to buy: line items priced in one Region's currency, plus the email,
addresses and shipping method that will become an Order. A Cart may have no Customer — a guest Cart,
remembered by its id in the browser — and signing in transfers it to the Customer. Switching Market
moves it to the new Region when every item can be sold there. A Cart is never reserved against
stock; it becomes exactly one Order when completed, and `completedAt` is stamped then. Store Copy
calls it the **bag** ("Your Bag"); the code, the API and this glossary say Cart.
_Avoid_: bag (in code and docs — Store Copy only), basket, checkout (for the thing itself), session

**Customer**:
The person a Cart and an Order belong to, identified by an email. A Customer exists for every
shopper who has given an email, registered or not: `hasAccount` says whether they can sign in, and
at most one Customer with an account and one without may hold the same email. A guest checkout
writes a Customer without an account; registering, or signing in and claiming a guest Cart, is what
ties a Cart to a Customer with an account.
_Avoid_: user (reserved for admin staff), account (for the person), shopper (in code), member, client

**Address**:
A postal destination and recipient — name, company, street lines, city, province, postal code,
country and phone. It takes three forms, and they are three different records: a Customer's
**saved address**, a row in their address book with an optional label and the main-address flags;
a Cart's address, its own copy per type, shipping and billing; and an Order's address, copied from
the Cart when it is placed and never touched by the address book again. Picking a saved address at
checkout copies it onto the Cart, so editing the saved address later changes neither Cart nor Order.
_Avoid_: location (reserved for Stock Location), destination, contact

**Order**:
A completed Cart, made permanent: the line items with their Variant Titles and prices copied at that
moment, the addresses and shipping method copied from the Cart, the email the confirmation went to,
and a shopper-facing number (`displayId`). Its status (pending, completed, canceled, archived) is
separate from its fulfillment status (preparing, ready to ship, shipped, delivered) and from its
payment status (awaiting, authorized, captured), and the storefront shows each on its own. A
guest's Order has no account to be listed under and is reached only from the confirmation page.
_Avoid_: purchase, receipt (for the record), transaction (reserved for the payment module's rows),
checkout

**Payment Method**:
A card or digital wallet a Customer with an account has stored at a payment gateway, so a later
checkout can pay with it without typing it again. The storefront knows only its network, last four
digits, expiry and whether it is the default; the gateway holds the method and the default, and
Proteus stores neither — only the account holder that links the Customer to the gateway. Distinct
from a **payment provider**, which is a way to pay that a Region offers at checkout (a card gateway,
a test-only provider): a shopper picks a provider, then may pick one of their Payment Methods within
it. A card past its expiry month is still listed but cannot be chosen. The Customer's list of
Payment Methods is their **wallet**.
_Avoid_: saved card (in code — Store Copy may say "card"), wallet (for one method, even a stored
digital wallet), payment (reserved for the payment module's record), payment provider (for a stored
card)

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
so choosing one also chooses the currency prices are quoted in, the payment providers offered and the
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
