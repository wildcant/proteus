# Multi-Step Product Create Form — Implementation Plan

## Architecture Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Form library | TanStack Form `FormGroup` + `withForm` | Native per-step validation, type-safe step components |
| Form structure | Nested by step, flatten on submit with spread | `FormGroup` requires a `name` key mapping to form values |
| Per-step validation | `AdminCreateProduct.pick()` per group | Single source of truth from http-schemas |
| Step count | 3 tabs: Details, Organize, Attributes | Organize kept for testing multi-step even if sparse |
| ProgressTabs | `apps/admin/src/components/` (not UI package) | Tightly coupled to modal header + Lucide icons |
| Draft vs Publish | `onSubmitMeta` with `{ intent: 'draft' \| 'publish' }` | TanStack Form's canonical pattern; `data-name`/submitter not viable |
| Footer | Shared footer using `useFormContext` + `form.Subscribe` | Reactive form state (isSubmitting) + consistent layout |
| Keyboard shortcuts | Per-wizard `onKeyDown` override on KeyboundForm | 7/9 Medusa wizards don't override; copy-paste pattern when needed |
| Step components | `withForm()` in `features/products/components/create-product-form/` | Type-safe form prop, colocated with parent |
| Outer form | Single KeyboundForm wrapping all steps | No nested forms; step FormGroups render fields only |
| Tab rendering | base-ui default (`keepMounted={false}`) | Only active panel mounted; field values persist in form store |
| es-toolkit | Skip for now | Flatten is a one-liner spread; install when real need arises |
| TanStack Hotkeys | Skip | Alpha; solves different problem than KeyboundForm |
| New shadcn components | Textarea (install to packages/ui) | Checkbox already installed; no NumberField needed |
| Status field | Set by submitMeta intent, not a UI component | Draft via "Save as Draft" button, published via "Publish" button |

## Component Hierarchy

```
ProductCreate (route: /products/create)
  └─ RouteFocusModal
       └─ RouteFocusModal.Form (unsaved changes guard, NOT a <form>)
            └─ KeyboundForm (<form>, custom onKeyDown for step advancement)
                 ├─ RouteFocusModal.Header
                 │    ├─ [X] close + [esc] badge (existing)
                 │    └─ ProgressTabs.List
                 │         ├─ ProgressTabs.Trigger "details"   (status icon + label)
                 │         ├─ ProgressTabs.Trigger "organize"  (status icon + label)
                 │         └─ ProgressTabs.Trigger "attributes"(status icon + label)
                 │
                 ├─ ProgressTabs.Content "details"
                 │    └─ StepDetails (withForm) → FormGroup name="details"
                 │
                 ├─ ProgressTabs.Content "organize"
                 │    └─ StepOrganize (withForm) → FormGroup name="organize"
                 │
                 ├─ ProgressTabs.Content "attributes"
                 │    └─ StepAttributes (withForm) → FormGroup name="attributes"
                 │
                 └─ RouteFocusModal.Footer (shared, form-aware)
                      ├─ [Cancel]         RouteFocusModal.Close
                      ├─ [Save as Draft]  type="button" → form.handleSubmit({ intent: 'draft' })
                      └─ [Continue]       type="button" → continueRef.current()
                         or [Publish]     type="button" → form.handleSubmit({ intent: 'publish' })
```

## Data Flow

### Form Values (nested by step)

```ts
defaultValues: {
  details: {
    title: '',
    subtitle: '',
    handle: '',
    description: '',
  },
  organize: {
    discountable: true,
  },
  attributes: {
    material: '',
    originCountry: '',
    hsCode: '',
    midCode: '',
    weight: null as number | null,
    length: null as number | null,
    height: null as number | null,
    width: null as number | null,
  },
}
```

### On Submit (flatten + set status)

```ts
onSubmit: ({ value, meta }) => {
  const status = meta.intent === 'draft' ? 'draft' : 'published'
  const payload = { ...value.details, ...value.organize, ...value.attributes, status }
  createMutation.mutate(payload, { ... })
}
```

### Per-Step Validation

```ts
// Details step — title required, rest optional (preserved from AdminCreateProduct)
const detailsSchema = AdminCreateProduct.pick({ title: true, subtitle: true, handle: true, description: true })

// Organize step — all optional, never blocks Continue
const organizeSchema = AdminCreateProduct.pick({ discountable: true })

// Attributes step — all optional
const attributesSchema = AdminCreateProduct.pick({
  material: true, originCountry: true, hsCode: true, midCode: true,
  weight: true, length: true, height: true, width: true,
})
```

### Tab State Machine

```ts
const [tab, setTab] = useState<Tab>('details')
const [tabState, setTabState] = useState<Record<Tab, ProgressStatus>>({
  details: 'in-progress',
  organize: 'not-started',
  attributes: 'not-started',
})
```

Forward-only waterfall: advancing to tab N marks all tabs < N as "completed", tab N as "in-progress".

### "Continue" Button → FormGroup Bridge

Each `withForm` step component receives a `continueRef` prop and sets it inside the FormGroup:

```ts
// Inside step component's FormGroup render:
useEffect(() => {
  continueRef.current = () => formGroup.handleSubmit()
  return () => { continueRef.current = undefined }
}, [formGroup])
```

Footer's Continue button: `onClick={() => continueRef.current?.()}`

Last step's `onGroupSubmit` calls `form.handleSubmit({ intent: 'publish' })` instead of advancing.

### Cmd+Enter (onKeyDown override)

```ts
const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
  if (e.key === 'Enter') {
    if (e.target instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    if (e.metaKey || e.ctrlKey) {
      if (tab !== LAST_TAB) {
        continueRef.current?.()         // advance step
      } else {
        form.handleSubmit({ intent: 'publish' })  // submit
      }
    }
  }
}
```

## Implementation Phases

### Phase 1: Infrastructure

#### 1a. Install shadcn Textarea
```bash
pnpm --filter @proteus/ui run shadcn:add textarea
```
Export from `packages/ui/src/index.ts`.

#### 1b. Update form-context.ts
```ts
// apps/admin/src/lib/form-context.ts
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts()
```

#### 1c. Update form-hook.ts
```ts
// apps/admin/src/lib/form-hook.ts
import { TextareaField } from '#/components/form/textarea-field.tsx'
import { CheckboxField } from '#/components/form/checkbox-field.tsx'

export const { useAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: { TextField, TextareaField, CheckboxField },
  formComponents: {},
})
```

#### 1d. New form field components

**`apps/admin/src/components/form/textarea-field.tsx`**
- Same pattern as TextField but renders `<Textarea>` from `@proteus/ui`
- Uses `useFieldContext<string>()`

**`apps/admin/src/components/form/checkbox-field.tsx`**
- Renders `<Checkbox>` with label
- Uses `useFieldContext<boolean>()`

### Phase 2: Expand Product API

#### 2a. Expand AdminCreateProduct schema
```ts
// packages/http-schemas/src/admin/product/payloads.ts
export const AdminCreateProduct = z.object({
  title: z.string().min(1),
  subtitle: z.string().optional(),
  handle: z.string().optional(),
  description: z.string().optional(),
  status: ProductStatus.optional(),
  discountable: z.boolean().optional(),
  material: z.string().optional(),
  originCountry: z.string().optional(),
  hsCode: z.string().optional(),
  midCode: z.string().optional(),
  weight: z.number().nullable().optional(),
  length: z.number().nullable().optional(),
  height: z.number().nullable().optional(),
  width: z.number().nullable().optional(),
}).openapi('AdminCreateProduct')
```

#### 2b. Update backend OpenAPI middleware
Update `apps/backend/src/api/admin/products/middlewares.ts` to reflect new schema.

#### 2c. Regenerate clients
```bash
pnpm run openapi:generate
```

### Phase 3: ProgressTabs Component

**`apps/admin/src/components/progress-tabs.tsx`**

Based on Medusa source, adapted for base-ui Tabs + Lucide icons:

```
ProgressTabs (root)          — thin wrapper around Tabs
ProgressTabs.List            — flex row of triggers
ProgressTabs.Trigger         — status icon + label, styled with border-right separators
ProgressTabs.Content         — same as TabsContent
```

Status icons (Lucide equivalents of Medusa's @medusajs/icons):
- `not-started` → `CircleDotDashed` (dotted circle)
- `in-progress` → `CircleDot` (half-filled circle)
- `completed`   → `CircleCheck` (checkmark circle)

Styling adapted from Medusa:
- h-[52px] triggers with equal flex width
- border-right separators between triggers
- muted text → active text color transition
- muted icon → primary icon color when active

### Phase 4: Multi-Step Product Create Form

All files in `apps/admin/src/features/products/components/create-product-form/`:

#### 4a. `constants.ts`
```ts
export const Tab = { DETAILS: 'details', ORGANIZE: 'organize', ATTRIBUTES: 'attributes' } as const
export type Tab = (typeof Tab)[keyof typeof Tab]
export const TABS = [Tab.DETAILS, Tab.ORGANIZE, Tab.ATTRIBUTES] as const
export type ProgressStatus = 'not-started' | 'in-progress' | 'completed'
export type SubmitIntent = { intent: 'draft' | 'publish' }
```

#### 4b. `schemas.ts`
Per-step schemas derived from `AdminCreateProduct.pick()`.

#### 4c. `step-details.tsx`
```ts
export const StepDetails = withForm({
  ...productCreateFormOpts,
  props: { continueRef: ... },
  render: function Render({ form, continueRef }) {
    return (
      <form.FormGroup
        name="details"
        validators={{ onDynamic: detailsSchema }}
        onGroupSubmit={() => { /* parent advances tab */ }}
      >
        {(formGroup) => {
          // Set continueRef so footer can trigger this group's submit
          useEffect(() => { continueRef.current = () => formGroup.handleSubmit() }, [])
          return (
            <>
              <form.AppField name="details.title">
                {(f) => <f.TextField label="Title" autoFocus />}
              </form.AppField>
              <form.AppField name="details.subtitle">
                {(f) => <f.TextField label="Subtitle" />}
              </form.AppField>
              <form.AppField name="details.handle">
                {(f) => <f.TextField label="Handle" />}
              </form.AppField>
              <form.AppField name="details.description">
                {(f) => <f.TextareaField label="Description" />}
              </form.AppField>
            </>
          )
        }}
      </form.FormGroup>
    )
  },
})
```

#### 4d. `step-organize.tsx`
- FormGroup name="organize"
- `discountable` checkbox (only field for now)

#### 4e. `step-attributes.tsx`
- FormGroup name="attributes"
- material, originCountry, hsCode, midCode (TextField)
- weight, length, height, width (Input type="number")

#### 4f. `create-product-form.tsx` (orchestrator)
- `useAppForm` with nested defaultValues, `revalidateLogic()`, full `onDynamic` schema, `onSubmitMeta`, `onSubmit`
- `useState` for `tab` and `tabState`
- `useRef` for `continueRef`
- `onGroupSubmit` callbacks advance tab + update tabState
- Custom `onKeyDown` on KeyboundForm for Cmd+Enter step advancement
- ProgressTabs in RouteFocusModal.Header
- Step components in ProgressTabs.Content panels
- Shared footer with Cancel / Save as Draft / Continue|Publish
- Footer uses `form.Subscribe` for isSubmitting state

### Phase 5: Update use-create-product-form.ts

**`apps/admin/src/features/products/hooks/use-create-product-form.ts`**

Export `productCreateFormOpts` (via `formOptions()`) for `withForm` step components to import.
The `useCreateProductForm` hook uses `useAppForm({ ...productCreateFormOpts, ... })`.

## File Summary

| File | Action |
|------|--------|
| `packages/ui/src/components/ui/textarea.tsx` | Install (shadcn) |
| `packages/ui/src/index.ts` | Add Textarea export |
| `apps/admin/src/lib/form-context.ts` | Add `useFormContext` export |
| `apps/admin/src/lib/form-hook.ts` | Add `withForm` export + new field components |
| `apps/admin/src/components/form/textarea-field.tsx` | Create |
| `apps/admin/src/components/form/checkbox-field.tsx` | Create |
| `apps/admin/src/components/progress-tabs.tsx` | Create |
| `packages/http-schemas/src/admin/product/payloads.ts` | Expand schema |
| `apps/backend/src/api/admin/products/middlewares.ts` | Update OpenAPI |
| `apps/admin/src/features/products/hooks/use-create-product-form.ts` | Rewrite (formOptions + expanded form) |
| `apps/admin/src/features/products/components/create-product-form/constants.ts` | Create |
| `apps/admin/src/features/products/components/create-product-form/schemas.ts` | Create |
| `apps/admin/src/features/products/components/create-product-form/step-details.tsx` | Create |
| `apps/admin/src/features/products/components/create-product-form/step-organize.tsx` | Create |
| `apps/admin/src/features/products/components/create-product-form/step-attributes.tsx` | Create |
| `apps/admin/src/features/products/components/create-product-form/create-product-form.tsx` | Create |
| `apps/admin/src/routes/_authed/_shell/products/create.tsx` | Update import path |
| Old `apps/admin/src/features/products/components/create-product-form.tsx` | Delete (replaced by directory) |
