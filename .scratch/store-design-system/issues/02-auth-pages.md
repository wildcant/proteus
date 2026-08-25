# 02 — Auth pages

**What to build:** a shopper can sign in, sign up, verify from an emailed link, and reset a
forgotten password on pages that stand on their own — no nav, no footer, no card around the form —
with the design system's input and button treatments proved on real surfaces before any other page
adopts them.

**Blocked by:** `01-token-foundation.md`.

**Status:** shipped — `f30bafd` (foundation and the split) and `ca80ee1` (password reset).

- [x] `/login` and `/signup` are separate pages, each with its own heading, form and cross-link
- [x] Auth pages render with the wordmark as their only chrome, and one click back to shopping
- [x] `/verify` confirms an emailed code exactly once per navigation, and reports a bad link as a
      verification outcome rather than an application error
- [x] Signing in before verifying returns the shopper to the check-your-email step instead of a
      dead end
- [x] `/forgot-password` and `/reset-password` sit on the same layout and behave the same way
- [x] Every text field floats its label, including when the browser autofills it
- [x] Submitting an empty reset form shows copy written for a shopper, not a validator's default
- [x] The whole set is covered end to end, including a reset that proves the old password stops
      working

## What shipped, and where it diverged from the plan

**The login page became three pages.** The plan kept one `/login` route switching between
`sign-in`, `register` and `verify-pending` views. It shipped as `/login`, `/signup` and `/verify`
under a new pathless layout route, with the check-your-email state shared between the first two as
a component. Three states behind one URL cannot be linked to, and the signup flow needs to send
people somewhere.

**Pathless layout, so the URLs never moved.** The layout is what removes the nav and footer and
supplies the wordmark. Because it is pathless, `/login` stayed `/login` — which is what let the
password reset pages move onto it later without touching the emailed reset link the backend builds.

**No eyebrow.** The plan had a muted "Account" eyebrow over a display-scale title. It shipped as a
shared heading component — title plus one muted supporting line — with the display role carried by
the layout's wordmark instead. Two display-weight elements stacked on a 448px column fought each
other.

**The vocabulary changed after all.** The plan's constraint was that the e2e spec pass
*unmodified*, on the grounds that the copy was load-bearing. It did not: splitting the page changed
the headings, and "Join us" became "Sign up" for consistency with the page it now names. The spec
was rewritten in both commits. The constraint was right in spirit — the label associations *are* the
contract, and `getByLabel('Email')` still holds — but it was too strict about the words.

**Password reset was not in the plan.** The two pages were still on the old layout inside their old
card, and moving them was the natural close of the same piece of work.

## Decisions worth keeping

**The floating label is CSS, not state.** The float is driven by a space placeholder and
`:placeholder-shown`, so browser autofill floats the label correctly — autofill clears
`:placeholder-shown` but fires no change event, which is exactly what a state-driven version
misses. The label sits inside the box rather than notched onto the border, and is
`pointer-events-none` so a click on the resting label lands on the input beneath it.

**One edit reached every form in the store.** Pointing the shared text field at the new input and
dropping its separate label propagated the treatment to all 26 usages at once: auth, password
reset, and the five checkout forms.

**The store button had a latent bug.** Passing a `size` discarded *all* store styling and fell back
to the shadcn defaults, which is why icon buttons were round while text buttons were square.
Variant treatment now always applies; only height and padding step aside when `size` is given.

**Validation copy belongs in the schema.** An empty reset submit was rendering Zod's raw "Too
small: expected string to have >=1 characters" to shoppers. Fixed at the shared payload schema
rather than worked around in the form, and confirmed the message does not leak into the generated
OpenAPI spec.

**Verification confirms in the loader.** The code is single-use, so confirming in an effect would
burn it twice under StrictMode. A loader runs once per navigation, outside render.

## Coverage

`auth.spec.ts` runs five specs: signup through the emailed link to a first sign-in; signing in
before verifying; the full forgotten-password reset; invalid credentials; and the redirect for
unauthenticated access. The reset spec asserts the *old* password is rejected before the new one
works — a passing new-password login on its own would not distinguish replacing a credential from
adding a second one.
