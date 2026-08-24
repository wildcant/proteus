# 03 — Address ownership inversion

**What to build:** Every order and cart owns a private, isolated copy of its addresses, and deleting
the parent takes them with it. Today the parent points at its addresses, so nothing removes them —
not the database on a hard delete, nor any service on a soft one — and every rolled-back checkout
leaves up to two rows behind forever.

**Blocked by:** 02 — the headline behaviour ("deleting an order removes its addresses") is only true
for the soft path once the walker exists.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] An order address carries a non-nullable reference to its order with cascade-on-delete, plus a role discriminator distinguishing shipping from billing
- [ ] A partial unique index enforces one address per role per order, excluding soft-deleted rows, so replacing an address is possible
- [ ] The order's two address pointer columns are dropped; the same treatment is applied to cart
- [ ] Hard-deleting an order removes its addresses via the database alone
- [ ] Soft-deleting an order hides its addresses via the walker
- [ ] A rolled-back checkout leaves no address rows behind; a test covers the compensation path
- [ ] The order-creation payload accepts nested addresses rather than identifiers, since the order must now exist before its addresses
- [ ] `complete-cart` creates the order first and then its addresses
- [ ] An address cannot exist without a parent
- [ ] HTTP schemas drop the address identifier fields; the generated clients are regenerated
- [ ] The store cart route returns each cart's shipping and billing address after the change, asserted in the existing cart API tests. The store order route has no test file today; if one is added for this, that is a second new seam beyond the cart module test in ticket 02
- [ ] Order and cart migrations are regenerated in place under their existing tags. Cart's migration has **already** been regenerated to drop the three unused tables (credit lines and two tax-line tables) — only the live dev database still holds them, which a cold re-migrate resolves
- [ ] The ADR from ticket 02 is accurate about what was built
- [ ] Full backend suite green; `npm run verify` green

## Notes — read before touching the pointer columns

**Postgres cannot cascade forward, and the obvious one-line "fix" destroys data.** Verified against a
live database: deleting a row never affects the row it points at (the order was deleted, its address
survived). Worse, adding cascade-on-delete to the parent's pointer column reverses the meaning —
deleting the *address* then deletes the *order* (verified: the order row disappeared).

So the edit that looks like a one-line fix for the orphan bug is a data-loss bug, and it is exactly
the edit someone reaches for on seeing the pointer column. Inverting removes the possibility. Until
the inversion lands, no cascade may be added to those pointer columns.

**Do not harmonise customer addresses to the same shape.** Customer address keeps its boolean role
flags and is not given the shipping/billing enum introduced here. A customer address can hold both
default roles at once — one row that is both default shipping and default billing — and an enum
forces a duplicate row to express that. Orders are the opposite: the row is a snapshot, duplication
is free, and each snapshot has exactly one role. Only customer address's index predicates change,
in ticket 01.

If ticket 01 has landed, declare this ticket's partial unique index through its helper rather than
hand-writing the predicate.

This inverts relative to Medusa, deliberately. Medusa contradicts itself here: its customer address
is inverted, and of the three that are not, cart and fulfillment cascade to their address while
order does not — the same defect this ticket fixes. Our own customer and fulfillment addresses are
already inverted, so this makes all four consistent.
