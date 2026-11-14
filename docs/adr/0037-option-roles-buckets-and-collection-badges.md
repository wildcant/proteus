# 37. Option Roles, Filter Buckets and Collection Badges

The store's list card and filters need to know which option is "the colour" and which is "the size",
which colour words make one swatch, and which products are new. A shoe shop answers with colour and
size, a furniture shop with material and dimensions, a coffee shop with flavour and weight. None of
those names belong in Proteus, so the catalogue says which option plays which part, and Proteus
reads the parts.

## Decision

**Option roles.** The global option (`product_option`) has a nullable `listing_role`:

- `grouping`: the option whose values each have their own look and photo. The card shows one entry
  per value (`groups`), each with its thumbnail, stock and the variant the product page opens on.
- `availability`: the option whose in-stock values the card lists (`available`).

A product reads at most one option per role, the first in its own option order
(`product_product_option.rank`). A product with no option in a role gets `null`.

**Filter buckets.** An option can have buckets: `product_option_bucket (option_id, name, swatch, words,
rank)`. A value is in any number of them, through the pivot `product_option_value_bucket (value_id,
bucket_id)`. The filter counts and selects a bucketed value by its buckets' names, and any other value by
itself (`COALESCE(bucket.name, value)` over a left join of the pivot), in SQL. A value in two buckets is
two joined rows, so it counts under each, and `COUNT(DISTINCT product)` counts a product once per bucket
it reaches. `filter=option.Color:Red` matches any value in Red. The swatch a facet value carries is its
bucket's.

A value joins every bucket that lists one of its words (whole words, ignoring case): "Black and White" is
in Black and in White. It joins when it is written: when a value is created, renamed or imported, and
when the option's buckets are rewritten. The filter then joins a pivot. It does not match text on every
query.

A bucket's `swatch` is free text: a hex, a CSS colour, an image URL or a key. Proteus stores it and hands
it on; the storefront decides what it means.

**The card's grouping values carry their buckets.** Each `groups.values[]` entry lists `buckets`, the
names of the buckets it is in. When the request filters by the grouping option, the item's
`activeGroupValue` is the first group value that filter selects (by a bucket's name, or by itself when it
is in none), and its thumbnail, when it has one, becomes the item's `thumbnail`. The card opens on the
colourway the shopper chose.

**Collection badges.** `product_collection.badge` (text, nullable). A list card's `badges` are the
badges of the product's Collections, each once.

**The card subline.** The line under a card's title comes from the structure file's `card.subline`, a
template, so no storefront hard-codes "{type} for {gender}":

```yaml
card:
  subline: "{type} para {genero|lower} · {estilo}"
  listSeparator: " y "   # joins a field's several values; default ", "
```

`{type}` is the product's Type and `{brand}` its brand, as written. `{<key>}` is a declared field's
values, each by its label: the name of the Category naming it, else capitalised. `|lower` lower-cases
what a placeholder renders. The template splits into segments at ` · `, and a segment shows only when
every placeholder in it has a value: with no gender, "Zapatillas para" goes whole, not "Zapatillas para
· Clásicos". No segment left is `subline: null`. The fields are read once for the page.

**The structure file** declares them: `options: [{ name, role, buckets: [{ name, swatch, words }] }]` and
`badge` on a collection. Applying the file sets exactly these on each option it names, and creates the
option when no option has that title. An option the file does not name keeps what it has, so a role
set in the admin survives a file that never mentions it.

## Considered Options

**Store-wide settings** (`CATALOG_CONVENTIONS` in `@proteus/store-config`: size option title, colourway
option title, the "new" Collection's handle). Rejected: it names one store's two parts and one badge,
and a catalogue that varies by material or sells several badges has nowhere to say so.

**Colour families matched at query time** (`~*` over the colour option's values against word lists).
Rejected: one regex join per query and per count, and it only ever covered colour. Buckets assigned at
write time do the same for any option, and their counts are a plain `GROUP BY`.

**A value in one bucket** (a nullable `product_option_value.bucket_id`, the first bucket by rank).
Rejected: "Black and White" landed in Black alone, so a shopper filtering by White never found it. The
pivot costs one more left join, and the facet stays one `GROUP BY`.

## Consequences

- **`words` is stored on the bucket**, beyond the name, swatch and rank, because a value written after
  the buckets (an import, a new colourway) must find its bucket without the file.
- **A bucketed value is selected only by its buckets.** `filter=option.Color:Jet Black` matches nothing
  once "Jet Black" is in Black; the filter offers Black.
- **A product can count under several buckets.** Black 2 and Red 2 can share a product, so a facet's
  counts no longer sum to the products in view.
- **`@proteus/store-config` keeps the store's name and markets only.** `COLOR_FILTER_KEY` goes too: a
  facet value's swatch comes from its bucket.
- **Every read is page-scoped.** Roles, groups and their buckets, the active group value, availability
  and badges are read for the page's products alone, on top of the listing (ADR 0035).
