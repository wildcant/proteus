# Components

The components the storefront ships, grouped by where they live in `apps/store/src/`. Each one comes from a set in `~/designs/proteus/Proteus.figcraft` once its slice draws it; until then it is marked **not yet drawn** and its look still lives in code. Colours are `color/*` roles, text is `type/*` or the body and meta sizes (`DESIGN.md`). Numbers after a set, once drawn, are FigCraft node ids.

## From FigCraft to code

**The page decides the folder.** Each component has a folder of its own holding the hand-written component and, beside it, its generated variants file:

| FigCraft page | Code folder |
|---|---|
| `components/ui` | `src/components/ui/<name>/` (store primitives, on `@base-ui/react`) |
| `components/store` | `src/components/<name>/` (store-wide blocks: header, footer, form fields, panel, pagination) |
| `entities/<entity>` | `src/entities/<entity>/ui/<name>/` |
| `features/<feature>` | `src/features/<feature>/components/<name>/` |
| `app/<group>` | none: screen sets are composed by hand in the routes from the parts above |

**Generated, never edited by hand** (each exporter in `@proteus/design` has a `--check` in the verify gate):

- `<name>.variants.ts` from `components:export <Name>`: one `cva()` per styled layer, with Tailwind classes. The component set is `<Name>`; layer names are the `cva` export names (`button` for the component, `buttonLabel` for its layer named `label`). Snapshot: `packages/design/figcraft/components/<Name>.json`.
- `src/components/ui/icon/icon.glyphs.tsx` from `icons:export`: one entry per variant of the `Icon` set (`name=<kebab-case>`, one colour, 24 × 24), the inside of the `<svg>` drawn in `currentColor`, and the `IconName` type. The hand-written `icon.tsx` beside it draws the frame, so an icon is a typed `name` prop, not a `lucide-react` import. Neither file exists until the design file has an `Icon` set. Snapshot: `packages/design/figcraft/icons/<name>.svg`.
- Brand images from `brand:export`, into `apps/store/public/`: each frame of the `brand` page's `export` section is the file its pluginData names there (`docs/design/brand-marks.md`). `brand:check` fails when a recorded file is missing, resized or edited since the export. Snapshot: `packages/design/figcraft/brand.json`.
- `src/navigation/flow.gen.ts` from `flow:export`: per screen, per event, the transitions drawn on the `flows` page, same-screen events included (they change the URL). Empty until the page is drawn. Snapshot: `packages/design/figcraft/flows.json`.
- `DESIGN.md`'s frontmatter from `design-md`: colors, typography, rounded and spacing from the token snapshot; components from the component snapshots, one entry per exported set variant.
- The theme (`packages/design/tokens/tokens.gen.css`) from `tokens:export`.

**Hand-written:**

- The component's `.tsx` beside its variants: the `@base-ui/react` part, props, ARIA, focus and keyboard, text as children or props, and the variants that follow runtime state (hover, focus, `disabled`, open, data). It imports the variants and `cn()` from `@proteus/ui-core` and adds no classes of its own beyond layout passed by the caller.
- Screen composition in routes and feature components, and the prose of `DESIGN.md` and this file.
- The screen table, `src/navigation/screens.ts`: each design screen (`ProductDetail`), and each state with a route or URL of its own (`AddressBook/addressEdit`, `Root/search`), to the route that renders it and where a link to it goes. `Root` is the `_main` chrome; `AuthLayout` and `CheckoutLayout` the chrome of those layouts; drawers are states of the screen they cover.

**Navigation.** `src/navigation/` may be imported only by routes (`navigation-only-from-routes` in `structure/.dependency-cruiser.cjs`). A route calls `flowLinks('<Screen>')` (`src/navigation/links.ts`) and passes the result to its feature as props. Each event is a function returning TanStack link options (`to`, `params`, `search`): the feature spreads them on `<Link>`, so every navigation is a real `<a href>` with preloading, also during SSR. After a mutation the route passes the same options to `navigate`. An event with several targets takes the target first (`links.SIGNED_IN('AccountDetail')`). `flow:check` (`check:flow`) fails when a target on the map has no entry in the screen table, a screen on the map has no route, a route is no screen's, or a leaf route doesn't render its screen (itself or through its layout). Routes that render only `<Outlet />`, or redirect with no component, are skipped by their shape.

**The viewport rule.** A set whose layout changes across breakpoints has a design-only `viewport` property with values `mobile`, `sm`, `md` and `lg` (Tailwind's `sm` 40rem, `md` 48rem, `lg` 64rem). It never becomes a `cva` prop. `mobile` values are the base classes; each larger value emits only the classes that differ from the next value down, under its prefix. `sm` and `md` are drawn only where the set changes there. Responsive behaviour is CSS only.

**What is never exported:** screen sets (`app/*` pages, description starting "Screen set"), the `flows` page, the `brand` page's sources and previews, and design-only sets on the exporter's not-exported list.

**A component never fills its parent.** Width is the caller's layout (`className="w-full"`, fill width on the FigCraft instance). Callers pass layout classes only.

## src/components/ui

Primitives the store takes from `@proteus/ui` today. Each moves into `src/components/ui/<name>/` on `@base-ui/react` in the primitives slice, in this order. All **not yet drawn**.

- `Button` (and `ButtonLink`): today `src/components/button.tsx`, wrapping the shared button with the store's sizes (52 px) and variants `default`, `outline`, `ghost`, `link`.
- Forms: `Field`, `FieldLabel`, `FieldSet`, `FieldGroup`, `FieldError`, `Input`, `Label`, `Checkbox`, `RadioGroup` / `RadioGroupItem`, `NativeSelect` / `NativeSelectOption`.
- `Drawer` (`DrawerContent`, `DrawerTitle`, `DrawerClose`), the route drawer (`RouteDrawer`), and the alert-dialog prompt (`usePrompt`).
- `Skeleton`.
- `Toaster` over the shared toast manager (`toast()`).
- `Tooltip`, `DropdownMenu`, `Collapsible`, `Accordion`.
- `QuantityStepper`: today `src/features/cart/components/quantity-stepper.tsx`; becomes a primitive, it holds no cart logic.

## src/components (store blocks)

Page `components/store`. All **not yet drawn**.

- `Header` (`header/`): the bar with `Nav`, `Wordmark`, `SearchControl`, `SearchForm`, the search triggers, `SideMenu` and its `Menu`.
- `Footer`, `MarketSelect`, `ThemeToggle`.
- Form fields (`form/`): `TextField`, `SelectField`, `CountryField`, `CheckboxField`, `Input`, `Select`, `FloatingLabel`, `LabelText`, `FieldHelp`, `FieldErrors`, `SubmitButton`, `Form`.
- `Panel`, `Pagination`, `Popover`, `StoreDrawer`, `NotFound`, `PaymentRow`, `PaymentNetwork`.

## src/entities

Page `entities/<entity>`. An entity exists once two features use its code (`docs/adr/0034-store-entities-layer-replaces-the-feature-graph.md`). Display components move here when they are that entity's display. **Not yet drawn**; candidates from the inventory: `address` (`AddressLines`), `payment-method` (`SavedCardRow`).

## src/features

Page `features/<feature>`; the feature's own components, no screens. All **not yet drawn**.

- `account`: `AccountDetail`, `AccountSkeleton`, `DetailsPanel`, `OrdersPanel`, `PasswordPanel`, `PaymentMethodsBook`, `PaymentMethodsBookView`, `SavedCardRow`.
- `address`: `AddressBook`, `AddressCard`, `AddressForm`, `AddressLines`, `CreateAddressForm`, `UpdateAddressForm`, `MainAddressPanel`.
- `auth`: `AuthHeading`, `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `ResetPasswordForm`, `VerifyPending`.
- `cart`: `CartDrawer`, `CartDrawerSkeleton`, `CartEmpty`, `CartItem`, `CartMarketSwitch`, `CartMismatchBanner`, `CartTrigger`.
- `checkout`: `CheckoutContent`, `CheckoutForm`, `CheckoutSection`, `CheckoutSkeleton`, `CheckoutSummary`; contact (`CheckoutAccount`, `ContactForm`, `ContactSection`); delivery (`AddressActions`, `DeliverySection`, `ShippingAddressForm`, `ShippingAddressPicker`); shipping (`ShippingMethodForm`, `ShippingMethodSection`); payment (`CheckoutReturn`, `PaymentForm`, `PaymentMethodSelector`, `PaymentSection`, `ProviderPanels`, `SaveMethodConsent`).
- `orders`: `OrderContent`, `OrderContentSkeleton`, `OrderDetails`, `OrderDetailsSkeleton`, `OrderConfirmedContent`, `OrderConfirmedSkeleton`, `OrderError`, `OrderItems`, `OrderProgressTrack`, `OrderSummary`, `DeliveryDetails`, `PaymentDetails`.
- `products`: `ProductListPage`, `ProductList`, `ProductListHeader`, `ProductListSkeleton`, `ProductListNotFound`, `ProductGrid`, `ProductCard`, `ProductFilters`, `ProductTagFilter`, `ProductSort`, `ProductEmpty`, `ProductError`, `CategoryBreadcrumb`, `CategoryIntro`, `CollectionHero`, `ProductDetail`, `ProductDetailSkeleton`, `ProductGallery`, `GalleryDots`, `VariantPicker`, `VariantStock`, `ProductSpecs`, `AddToCart`, `SearchDrawer`, `SearchResults`, `SearchBestSellers`.

## Design-only sets

None yet.
