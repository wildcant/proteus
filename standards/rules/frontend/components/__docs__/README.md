# Shared components

`src/components/` is the UI both apps keep outside any one feature. The rules here are scoped by
content rather than by path — `**/src/**/*.tsx` — because the mistakes they catch are mistakes
wherever they are written, including inside a feature.

| Document | Use case |
|---|---|
| [Data tables](./data-tables.md) | **Putting a list of records on screen.** Use when a page shows rows the merchant pages through, sorts, filters or searches. |
| [Form components](./form-components.md) | **Building a form's UI.** Use when a screen renders a form: the element it is wrapped in, the fields, and the button that submits it. |
| [Route modals](./route-modals.md) | **Opening a form over the page that launched it.** Use when a create or edit form should appear without taking the page behind it off screen. |

A form's UI is one half of a pair; the [form hook](../../features/hooks/__docs__/form-hooks.md) that
owns its schema, defaults and submit is the other. Data tables and route modals are admin-only
today; the storefront has neither.
