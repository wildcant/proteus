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
rank)`. Each value has a nullable `bucket_id`. The filter counts and selects a bucketed value by its
bucket's name, and any other value by itself (`COALESCE(bucket.name, value)`), in SQL. The swatch a
facet value carries is its bucket's.

A value joins the first bucket, by rank, that lists one of its words (whole words, ignoring case). It
joins when it is written: when a value is created, renamed or imported, and when the option's buckets
are rewritten. The filter then groups by a column. It does not match text on every query.

**Collection badges.** `product_collection.badge` (text, nullable). A list card's `badges` are the
badges of the product's Collections, each once.

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

**A value in several buckets** ("Black / Red" in Black and in Red, as the colour families allowed).
Rejected for now: one `bucket_id` keeps the facet a single `GROUP BY` and the counts honest (each
product once per value). The first bucket by rank decides, so a store ranks its buckets to choose.

## Consequences

- **`words` is stored on the bucket**, beyond the name, swatch and rank, because a value written after
  the buckets (an import, a new colourway) must find its bucket without the file.
- **A bucketed value is selected only by its bucket.** `filter=option.Color:Jet Black` matches nothing
  once "Jet Black" is in Black; the filter offers Black.
- **`@proteus/store-config` keeps the store's name and markets only.** `COLOR_FILTER_KEY` goes too: a
  facet value's swatch comes from its bucket.
- **Every read is page-scoped.** Roles, groups, availability and badges are read for the page's products
  alone, on top of the listing (ADR 0035).
