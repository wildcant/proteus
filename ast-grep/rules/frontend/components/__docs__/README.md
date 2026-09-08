# Shared components

`src/components/` is the UI both apps keep outside any one feature. The rules here are scoped by
content rather than by path — `**/src/**/*.tsx` — because the mistakes they catch are mistakes
wherever they are written, including inside a feature.

| Document | Use case |
|---|---|
| [Form components](./form-components.md) | **Building a form's UI.** Use when a screen renders a form: the element it is wrapped in, the fields, and the button that submits it. |

A form's UI is one half of a pair; the [form hook](../../features/hooks/__docs__/form-hooks.md) that
owns its schema, defaults and submit is the other.
