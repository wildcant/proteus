# Seed images

Product photography for `scripts/seed-dev.ts`. Committed so a fresh clone can seed a storefront
that looks like a storefront, without a network fetch at seed time.

## Provenance

All 114 photos come from [mock.shop](https://mock.shop), Shopify's public storefront-prototyping
API — the backend behind <https://demostore.mock.shop>. It needs no account or access token, and
Shopify publishes it for building proof-of-concept storefronts.

They were pulled from the `men` and `women` collections at 1200px via the Shopify CDN's `?width=`
parameter (the originals are 4096x4096), then renamed `{handle}-{colour}-{nn}.jpg`. The colourway
for each photo comes from the mock.shop variant that uses it, not from its original filename —
mock.shop's own names disagree with its option values in places (`ClayHoodie01.jpg` is the `Olive`
colourway).

To refresh or extend the set, re-run the pull against mock.shop and regenerate `CATALOG` in
`scripts/seed-dev.ts`; the two must stay in step, because the list of files to upload is derived
from the catalogue.

## Licence

Shopify offers mock.shop for prototyping and imposes no signup or token, but publishes no explicit
reuse licence for the image assets. Treat them as fine for local development and staging, and not
as assets to ship on a public production storefront. Anything customer-facing needs photography we
have the rights to — [Burst](https://www.shopify.com/stock-photos) grants that explicitly.
