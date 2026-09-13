# Button links

A control that navigates, wearing a button's look. The counterpart is the ordinary `Button`, which
does something on the page it is already on; if the control changes the URL, it belongs here.

## Structure

```
packages/ui/src/components/ui/button-link.tsx   ButtonLink — the anchor, and the shared button classes
apps/store/src/components/button.tsx            ButtonLink — the same, plus the storefront treatment
```

Admin imports `ButtonLink` from `@proteus/ui` directly. The store wraps it, exactly as it wraps
`Button`, because the storefront's height, ink borders and bold-underline `link` variant are its own
and admin must not inherit them.

## Shape

```tsx
<ButtonLink to="/checkout" className="w-full gap-2">
  <ShoppingBagIcon className="h-4 w-4" />
  Checkout
</ButtonLink>
```

`to`, `params` and `search` are the router's, typed against this app's route tree: each app calls
`createLink` on its own leaf component, whose router generic defaults to `RegisteredRouter` and
resolves where the component is rendered.

## Rules

### A link is never rendered through `Button`

`<Button render={<Link to="…" />}>` is the shape to reach for and the wrong one. base-ui's guidance
is that "links have their own semantics and should not be rendered as buttons through the `render`
prop" — `Button` runs `useButton`, which inspects the rendered tag and warns in dev when it is not a
`<button>`.

`nativeButton={false}` silences that warning and is not the fix: it tells base-ui the element takes
button semantics, so it merges `role="button"` onto the anchor. The link then announces as a button
and drops out of the links rotor, and the affordances a reader expects of an anchor — open in a new
tab, copy link address — no longer match what they are told they have.

`nativeButton={false}` is right where the element genuinely is not a link and not a `<button>`: a
`<div>`, or base-ui's own `Tabs.Tab` rendering a `Link`, where the tab role is the point.

### A trigger that is not a link renders a real `<button>`

The other half of the same warning. A collapsible section header, a disclosure, a menu trigger — none
of them navigate, so they get a `<button>` in the `render` prop rather than a role stitched onto a
`<div>`. `apps/admin/src/components/layout/settings-layout.tsx` is the worked example: the sidebar
group label is the collapsible's trigger, so it renders `<SidebarGroupLabel render={<button type="button" />} />`.

## Enforcement

| Rule id | The paragraph it enforces |
|---|---|
| `button-renders-a-link` | that a link is never rendered through `Button` |

## What is deliberately not enforced

- **A trigger rendering a non-button element.** The rule would have to know what tag
  `SidebarGroupLabel` renders, which is a fact about another component's body rather than about this
  file. base-ui's dev warning catches it the first time the component is put on screen.
- **The components that only look like they take button semantics.** `SidebarMenuButton`,
  `BreadcrumbLink` and `Panel` go through `useRender`, so an anchor keeps its link role. The rule
  matches the tag name exactly rather than by its `Button` suffix, which is what keeps them out of
  it.
- **Whether a control should navigate at all.** Whether Checkout is a link or a submit button is a
  design decision, and both shapes are legitimate; the standard only holds that the markup match
  whichever was chosen.
