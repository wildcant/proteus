# Product

Status: draft — awaiting owner approval. Nothing relies on this file until the owner approves it.

## Platform

web

## Stack

A pnpm monorepo. The storefront (`apps/store`) is TanStack Start on Cloudflare workerd with selective SSR (ADR 0013), React, Tailwind CSS v4 and `@base-ui/react`, translated with Lingui. The admin (`apps/admin`) and the backend (`apps/backend`, with Temporal workers) live beside it. The storefront's design source of truth is `~/designs/proteus/Proteus.figcraft`, exported through `@proteus/design` (`DESIGN.md`).

## Users

- **Shoppers** browsing and buying from a brand's store, most of them on a phone, some at a desk.
- **Brands** that fork the blueprint to run their own store: they change the design file, the copy and the catalogue, not the structure.
- The owner is the first developer; the blueprint is not in production.

## Product Purpose

Proteus is an e-commerce blueprint: a complete store a brand can fork and make its own. A store built on it does three jobs: let a shopper find a product, choose the variant they want, and pay for it with as little friction as a large direct-to-consumer store offers; then let them come back to see their orders, addresses and saved cards.

## Positioning

- **A blueprint, not a theme.** The catalogue, cart, checkout, orders, accounts and admin come together, and a fork changes the look in one design file.
- **Design-led.** The storefront's look lives in a design file the brand can edit without reading code, and the code is generated from it and checked against it.
- **Brand-neutral by default.** The blueprint's own look is a quiet neutral shop so that a fork's brand is the first thing anyone sees.

## Operating Context

Shoppers arrive mostly on a phone, often from a link to a product or a collection, and scan photographs before reading. Checkout happens once the bag is decided, on the same device, often as a guest. (Inferred from the store's mobile-first rule; confirm.)

## Capabilities and Constraints

- Catalogue: products with variants built from product options (size, colour), grouped by categories, collections, tags and types; listing pages with filters, sort and pagination; search with best sellers; a product page with gallery, variant picker and stock.
- Bag: a drawer with line items, quantity steppers, and a market switch when the bag and the shopper's market disagree.
- Checkout: contact (guest or signed in), delivery address (new or saved), shipping method, payment through provider adapters, a confirmation page.
- Accounts: sign up with email verification, log in, reset a password; an account page with details, password, orders and their progress, saved addresses and saved payment methods.
- Markets: a market decides currency and language; English and Spanish today. Copy comes from the Lingui catalogs.
- Light and dark themes, following the system with a shopper toggle.
- Responsive by CSS only; server-rendered pages are correct before JavaScript runs.
- Undecided: anything a specific brand adds (editorial pages, reviews, loyalty).

## Brand Commitments

- The blueprint carries no brand. Code, comments, docs and the design file never name a reference brand; they say "the reference" or `<Brand>`.
- The blueprint's look (`DESIGN.md`): ink on white, square, one typeface with an uppercase display voice, one hue for count badges, red for sale and destruction.
- A fork commits its own name, marks, palette and type in the design file, then exports. It does not edit generated code.

## Evidence on Hand

None. No shoppers, metrics or testimonials exist; do not invent them. Products, prices and copy in drawings come from the seed data and the `en` catalog.

## Product Principles

1. The product is the hero: the interface steps back so photographs and prices carry the page.
2. Every page works on a phone first and is complete when the server renders it.
3. The path to paying is short and forgiving: guests can check out, saved details are offered, nothing is asked twice.
4. One design file decides the look; code follows it and is checked against it.
