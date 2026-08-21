# 06 — Store checkout Contact form + step management

**What to build:** The store checkout gains a Contact step shown only to guests. It collects email (required), firstName (optional), and lastName (optional), then submits to the update cart endpoint. Authenticated users skip the Contact step entirely — their checkout starts at Address. Step numbers are computed dynamically so Address is step 1 for authenticated users and step 2 for guests.

**Blocked by:** 05 — Guest email flow

**Status:** ready-for-agent

- [ ] `CONTACT` added to the `Step` enum/object and the `STEPS` array in checkout constants (the route's `validateSearch` uses `z.enum(STEPS)`, so CONTACT must be in the array for the URL param to validate)
- [ ] `ContactForm` component created with email (required), firstName (optional), lastName (optional) fields
- [ ] `useContactForm` hook created following the project's form hook pattern — schema uses `.pick()` from `UpdateCart` with `.extend()` to make email required; mutation calls `useUpdateCart`
- [ ] `ContactForm` rendered conditionally in `CheckoutForm` — shown only when no auth token exists (guest). The currently hardcoded `stepNumber` props (1-4) must be computed dynamically: for guests, CONTACT=1, ADDRESS=2, DELIVERY=3, PAYMENT=4, REVIEW=5; for authenticated users, ADDRESS=1, DELIVERY=2, PAYMENT=3, REVIEW=4
- [ ] `useCheckoutProgress` hook updated: `hasContact` completion check (e.g., `!!cart.email`), dynamic step number computation based on whether CONTACT is shown
- [ ] Default step when navigating to `/checkout` without a step param: `CONTACT` for guests, `ADDRESS` for authenticated users. Since `validateSearch` `.catch()` is static, handle the dynamic default via a redirect in the component or route loader — not in the schema
- [ ] Guest checkout flow works end-to-end: CONTACT > ADDRESS > DELIVERY > PAYMENT > REVIEW
- [ ] Authenticated checkout flow unchanged: ADDRESS > DELIVERY > PAYMENT > REVIEW
- [ ] Contact form submit saves email to cart and advances to ADDRESS step
- [ ] Pre-filled values: if guest returns to Contact step after entering email, form shows previously entered values from `cart.email`
