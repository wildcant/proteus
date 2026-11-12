# Seed images

Product photography for the catalogue in `scripts/seed/product-import.csv`. Committed so a fresh
clone can seed a storefront that looks like a storefront, without a network fetch at seed time.

## Provenance

Every photo comes from [mock.shop](https://mock.shop), Shopify's public storefront-prototyping
API — the backend behind <https://demostore.mock.shop>. It needs no account or access token, and
Shopify publishes it for building proof-of-concept storefronts.

`scripts/seed/build-product-import-csv.ts` writes the CSV and downloads each image it names, at
1200px through the Shopify CDN's `?width=` parameter (the originals are 4096x4096). A file is named
after the last segment of its CDN URL, which mock.shop sets to the photo's content hash, so the
seed finds the file for a CSV URL without a lookup table. The script also deletes any file the CSV
no longer names, so rerunning it keeps the two in step:

```bash
pnpm --filter backend exec tsx scripts/seed/build-product-import-csv.ts
```

`scripts/seed-dev.ts` places these files in file storage, then imports the CSV with each CDN URL
swapped for the stored copy.

## Licence

Shopify offers mock.shop for prototyping and imposes no signup or token, but publishes no explicit
reuse licence for the image assets. Treat them as fine for local development and staging, and not
as assets to ship on a public production storefront. Anything customer-facing needs photography we
have the rights to — [Burst](https://www.shopify.com/stock-photos) grants that explicitly.
