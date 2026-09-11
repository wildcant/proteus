# Route-Based Modal System for TanStack Router + shadcn/ui (base-nova)

A complete modal system for CRUD operations built on TanStack Router and shadcn/ui components (base-nova style, `@base-ui/react` primitives). Provides route-driven modals with unsaved changes protection, multi-step forms, stacked modals, keyboard shortcuts, and search param preservation.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites: shadcn/ui Components](#prerequisites-shadcnui-components)
- [File Structure](#file-structure)
- [Core Concepts: TanStack Router Primitives Used](#core-concepts-tanstack-router-primitives-used)
- [RouteModalProvider -- Context Layer](#routemodalprovider----context-layer)
- [RouteFocusModal -- Full-Screen Create Modal (Drawer)](#routefocusmodal----full-screen-create-modal-drawer)
- [RouteDrawer -- Side Panel Edit Modal (Drawer)](#routedrawer----side-panel-edit-modal-drawer)
- [RouteModalForm -- Unsaved Changes Guard (AlertDialog)](#routemodalform----unsaved-changes-guard-alertdialog)
- [KeyboundForm -- Keyboard Shortcut Submit](#keyboundform----keyboard-shortcut-submit)
- [Stacked Modals (Modal-on-Modal)](#stacked-modals-modal-on-modal)
- [Route Masking for Modals](#route-masking-for-modals)
- [Search Param Preservation](#search-param-preservation)
- [Multi-Step Form Pattern](#multi-step-form-pattern)
- [Route Definitions](#route-definitions)
- [Complete Usage Patterns](#complete-usage-patterns)
- [Feature Summary](#feature-summary)

---

## Architecture Overview

Modals are **entirely driven by TanStack Router's nested route system**. Each modal is a child route rendered via `<Outlet />` by its parent page. The modal components manage their own open/close state -- they open on mount and navigate back to the parent route on close. There is no global modal state manager.

### Project Context

| Concern | Our Stack |
|---|---|
| UI component library | `@proteus/ui` (shadcn base-nova style, `@base-ui/react` primitives) |
| Form management | `@tanstack/react-form` with Zod v4 validators |
| Routing | TanStack Router (file-based, `/_authed/_shell/` layout groups) |
| Data fetching | TanStack React Query (Orval-generated hooks) |
| Validation | Zod v4 |

### shadcn/ui Component Mapping

| Modal System Component | shadcn/ui Base | `@base-ui/react` Primitive | Configuration  |  Purpose |
|---|---|---|---|
| `RouteFocusModal` | `Drawer` | `@base-ui/react/drawer` | Bottom-up (default) | Full-screen create/complex forms |
| `RouteDrawer` | `Drawer` | `@base-ui/react/drawer` | Right side (`swipeDirection="right"`) | Side panel edit forms |
| `StackedFocusModal` | `Drawer` | `@base-ui/react/drawer` | Bottom-up with offset | Secondary modal layered on top |
| `StackedDrawer` | `Drawer` | `@base-ui/react/drawer` | Right side with transparent overlay | Secondary drawer layered on top |
| Unsaved changes prompt | `AlertDialog` | `@base-ui/react/alert-dialog` | -- | Confirmation before discarding changes |
| Multi-step form tabs | `Tabs` | `@base-ui/react/tabs` | -- | Step navigation with progress indicators |

Both `RouteFocusModal` and `RouteDrawer` use the same shadcn `Drawer` -- the difference is the `swipeDirection`. The default bottom-up Drawer gives the same visual as Medusa's FocusModal: a panel that slides up from the bottom covering nearly the full screen, with a slight gap at the top.

```
apps/admin/src/components/modals/
├── route-focus-modal/          # Full-screen bottom-up drawer
├── route-drawer/               # Right-side drawer
├── route-modal-form/           # Form wrapper + unsaved changes (AlertDialog)
├── route-modal-provider/       # Context: navigation + success handler
│   ├── route-modal-context.tsx
│   ├── route-provider.tsx
│   └── use-route-modal.tsx
├── stacked-focus-modal/        # Bottom-up drawer-on-top
├── stacked-drawer/             # Right-side drawer-on-top
├── stacked-modal-provider/     # Context: manages stacked modal state
│   ├── stacked-modal-context.tsx
│   ├── stacked-modal-provider.tsx
│   └── use-stacked-modal.ts
├── hooks/
│   └── use-search-aware-to.tsx # Preserves search params on close
├── keybound-form.tsx           # Cmd/Ctrl+Enter submit
└── index.ts                    # Barrel export
```

---

## Prerequisites: shadcn/ui Components

Install the base components into `packages/ui`:

```bash
cd packages/ui
pnpm dlx shadcn@latest add drawer alert-dialog tabs
```

This adds three files to `packages/ui/src/components/ui/`:

### Drawer (for RouteFocusModal, RouteDrawer, StackedFocusModal, StackedDrawer)

The `Drawer` component wraps `@base-ui/react/drawer` and is the primary primitive for all modal surfaces. Both the full-screen create modal and the side-panel edit drawer use it -- the difference is `swipeDirection`.

```tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerSwipeHandle,
  DrawerTitle,
  DrawerTrigger,
} from "@proteus/ui"
```

Key props on `Drawer` root:
- `open` / `onOpenChange` -- controlled state
- `swipeDirection` -- direction to swipe to dismiss:
  - `"down"` (default): drawer slides up from bottom, swipe down to dismiss -- **used by RouteFocusModal**
  - `"right"`: drawer slides in from right, swipe right to dismiss -- **used by RouteDrawer**
- `modal` -- boolean (we always use `true`)
- `snapPoints` -- optional array for snap positions
- `showSwipeHandle` -- show/hide the swipe indicator bar

Key props on `DrawerContent` (renders `DrawerPrimitive.Popup` + `DrawerPrimitive.Viewport`):
- `className` -- sizing via `w-*`, `max-h-*` utilities
- Data attributes for styling: `data-swipe-axis`, `data-swipe-direction`, `data-snap-points`
- Built-in nested drawer support: `data-nested-drawer-open`, `data-nested-drawer-swiping`

The shadcn Drawer already handles:
- Overlay with backdrop blur
- Viewport with proper z-indexing
- Nested drawer scale/opacity transitions (stack effect)
- Swipe handle rendering
- Content wrapper with overflow containment

### AlertDialog (for unsaved changes prompt)

Wraps `@base-ui/react/alert-dialog`. Unlike Dialog, AlertDialog **cannot be dismissed** via Escape or overlay click -- users must explicitly click Cancel or Continue.

```tsx
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@proteus/ui"
```

Key differences from the Sheet/Dialog:
- `AlertDialogCancel` uses the `render` prop pattern: `render={<Button variant="outline" />}`
- `AlertDialogAction` is a styled `Button` (not a primitive Close)
- `AlertDialogContent` has a `size` prop: `"default"` | `"sm"`

### Tabs (for multi-step forms)

Wraps `@base-ui/react/tabs`.

```tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@proteus/ui"
```

Key props:
- `Tabs`: `value` / `onValueChange` for controlled state, `defaultValue` for uncontrolled, `orientation` (`"horizontal"` | `"vertical"`)
- `TabsList`: `variant` (`"default"` | `"line"`) -- line variant for underline-style tabs
- `TabsTrigger`: `value` (unique identifier), `disabled` to prevent interaction
- `TabsContent`: `value` (must match trigger)

Active triggers get `data-active` for CSS targeting. We extend triggers with progress status indicators for multi-step wizard flows.

### Exporting from @proteus/ui

After installing, add the new components to `packages/ui/src/index.ts`:

```tsx
// Add to packages/ui/src/index.ts
export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerSwipeHandle,
  DrawerTitle,
  DrawerTrigger,
} from './components/ui/drawer.tsx'

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './components/ui/alert-dialog.tsx'

export { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs.tsx'
```

---

## Core Concepts: TanStack Router Primitives Used

| Feature | TanStack Router Primitive | Purpose |
|---|---|---|
| Modal open/close | Child routes + `<Outlet />` | Modal mounts when child route matches |
| Navigate back | `useNavigate()` | Close modal by navigating to parent |
| Unsaved changes | `useBlocker()` | Block navigation when form is dirty |
| Search param state | `validateSearch` + `useSearch()` | Typed URL search params |
| Search preservation | Search middlewares / `retainSearchParams` | Keep parent filters on close |
| URL masking | `mask` option on `Link`/`navigate` | Show clean URL while rendering modal route |
| Context injection | `createRootRouteWithContext` + `beforeLoad` | Provide services to modal routes |
| Route params | `Route.useParams()` | Access entity IDs in edit modals |

---

## RouteModalProvider -- Context Layer

The provider wraps modal content and supplies two things: a `handleSuccess` callback for post-submit navigation, and a `setCloseOnEscape` toggle for DataGrid integration.

### Context Type

```tsx
// route-modal-context.tsx
import { createContext } from "react"

type RouteModalProviderState = {
  handleSuccess: (path?: string) => void
  setCloseOnEscape: (value: boolean) => void
  __internal: {
    closeOnEscape: boolean
  }
}

export const RouteModalProviderContext =
  createContext<RouteModalProviderState | null>(null)
```

### Provider Implementation

```tsx
// route-provider.tsx
import { PropsWithChildren, useCallback, useMemo, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { RouteModalProviderContext } from "./route-modal-context"

type RouteModalProviderProps = PropsWithChildren<{
  prev: string | number
}>

export const RouteModalProvider = ({
  prev,
  children,
}: RouteModalProviderProps) => {
  const navigate = useNavigate()
  const [closeOnEscape, setCloseOnEscape] = useState(true)

  const handleSuccess = useCallback(
    (path?: string) => {
      const to = path || prev

      if (typeof to === "number") {
        // Set success state on current location, then go back
        window.history.replaceState(
          { ...window.history.state, isSubmitSuccessful: true },
          ""
        )
        window.history.go(to)
      } else {
        navigate({
          to,
          replace: true,
          state: { isSubmitSuccessful: true },
        })
      }
    },
    [navigate, prev]
  )

  const value = useMemo(
    () => ({
      handleSuccess,
      setCloseOnEscape,
      __internal: { closeOnEscape },
    }),
    [handleSuccess, setCloseOnEscape, closeOnEscape]
  )

  return (
    <RouteModalProviderContext.Provider value={value}>
      {children}
    </RouteModalProviderContext.Provider>
  )
}
```

### Hook

```tsx
// use-route-modal.tsx
import { useContext } from "react"
import { RouteModalProviderContext } from "./route-modal-context"

export const useRouteModal = () => {
  const context = useContext(RouteModalProviderContext)
  if (!context) {
    throw new Error("useRouteModal must be used within a RouteModalProvider")
  }
  return context
}
```

### Key Design Decisions

**`handleSuccess` sets `isSubmitSuccessful: true` in router state.** This signals the navigation blocker (in `RouteModalForm`) not to show the unsaved changes AlertDialog after a successful save. The form IS dirty at that point (it was just submitted), but the state flag bypasses the block.

**Numeric `prev` special case:** `window.history.go(-1)` cannot carry state directly, so the state is placed on the current entry first via `replaceState`, then the history navigation is performed.

---

## RouteFocusModal -- Full-Screen Create Modal (Drawer)

Uses shadcn `Drawer` with default `swipeDirection="down"` (bottom-up). The drawer slides up from the bottom covering nearly the full screen with a slight gap at the top -- giving the same visual as Medusa's FocusModal.

```tsx
// route-focus-modal.tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  cn,
} from "@proteus/ui"
import { PropsWithChildren, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useSearchAwareTo } from "../hooks/use-search-aware-to"
import { RouteModalForm } from "../route-modal-form"
import { useRouteModal } from "../route-modal-provider"
import { RouteModalProvider } from "../route-modal-provider/route-provider"
import { StackedModalProvider } from "../stacked-modal-provider"

type RouteFocusModalProps = PropsWithChildren<{
  prev?: string | number
}>

const Root = ({ prev = "..", children }: RouteFocusModalProps) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [stackedModalOpen, onStackedModalOpen] = useState(false)

  const to = useSearchAwareTo(prev)

  // Open on mount for entry animation
  useEffect(() => {
    setOpen(true)
    return () => {
      setOpen(false)
      onStackedModalOpen(false)
    }
  }, [])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      document.body.style.pointerEvents = "auto"
      if (typeof to === "number") {
        window.history.go(to)
      } else {
        navigate({ to, replace: true })
      }
      return
    }
    setOpen(open)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <RouteModalProvider prev={to}>
        <StackedModalProvider onOpenChange={onStackedModalOpen}>
          <Content stackedModalOpen={stackedModalOpen}>{children}</Content>
        </StackedModalProvider>
      </RouteModalProvider>
    </Drawer>
  )
}

type ContentProps = PropsWithChildren<{ stackedModalOpen: boolean }>

const Content = ({ stackedModalOpen, children }: ContentProps) => {
  const { __internal } = useRouteModal()
  const shouldPreventClose = !__internal.closeOnEscape

  return (
    <DrawerContent
      className={cn(
        "flex flex-col",
        // Dim and shrink when stacked modal is open
        stackedModalOpen && "bg-muted inset-x-5 inset-y-3"
      )}
      onKeyDown={
        shouldPreventClose
          ? (e) => {
              if (e.key === "Escape") {
                e.preventDefault()
                e.stopPropagation()
              }
            }
          : undefined
      }
    >
      {children}
    </DrawerContent>
  )
}

const Header = DrawerHeader
const Title = DrawerTitle
const Description = DrawerDescription
const Footer = DrawerFooter
const Close = DrawerClose
const Body = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex-1 overflow-y-auto", className)} {...props}>
    {children}
  </div>
)
const Form = RouteModalForm

export const RouteFocusModal = Object.assign(Root, {
  Header,
  Title,
  Body,
  Description,
  Footer,
  Close,
  Form,
})
```

### Why Drawer for Full-Screen

The shadcn Drawer (wrapping `@base-ui/react/drawer`) provides:
- **Same visual as Medusa's FocusModal** -- slides up from the bottom, covering nearly the full screen with a slight gap at the top
- Native swipe-to-dismiss gesture for mobile
- Built-in entry/exit animations with CSS transitions (not JS-driven)
- Controlled `open`/`onOpenChange` -- maps directly to route-driven state
- Built-in nested drawer support with scale/opacity stacking effects

The near-full-screen effect comes from the Drawer's default sizing: `[--drawer-content-max-height:calc(100dvh-6rem)]` on vertical-axis drawers (configurable via className override).

### Body Sub-Component

shadcn Drawer doesn't ship a `Body` component, so we define a simple scrollable div wrapper (`flex-1 overflow-y-auto`). This keeps the compound API consistent across RouteFocusModal and RouteDrawer.

### Escape Key Control

When a DataGrid is being edited inside the modal, pressing Escape should exit the cell, not close the drawer. Components signal this via `setCloseOnEscape(false)`:

```tsx
const { setCloseOnEscape } = useRouteModal()

<DataGrid
  onEditingChange={(editing) => setCloseOnEscape(!editing)}
/>
```

We intercept Escape via `onKeyDown` on `DrawerContent`, preventing propagation so the Drawer's internal close handler never fires.

---

## RouteDrawer -- Side Panel Edit Modal (Drawer)

Uses shadcn `Drawer` with `swipeDirection="right"` -- a side panel that slides in from the right. For editing resources with simpler forms.

```tsx
// route-drawer.tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  cn,
} from "@proteus/ui"
import { PropsWithChildren, useEffect, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useSearchAwareTo } from "../hooks/use-search-aware-to"
import { RouteModalForm } from "../route-modal-form"
import { RouteModalProvider } from "../route-modal-provider/route-provider"
import { StackedModalProvider } from "../stacked-modal-provider"

type RouteDrawerProps = PropsWithChildren<{
  prev?: string | number
}>

const Root = ({ prev = "..", children }: RouteDrawerProps) => {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [stackedModalOpen, onStackedModalOpen] = useState(false)

  const to = useSearchAwareTo(prev)

  useEffect(() => {
    setOpen(true)
    return () => {
      setOpen(false)
      onStackedModalOpen(false)
    }
  }, [])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      document.body.style.pointerEvents = "auto"
      if (typeof to === "number") {
        window.history.go(to)
      } else {
        navigate({ to, replace: true })
      }
      return
    }
    setOpen(open)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} swipeDirection="right">
      <RouteModalProvider prev={to}>
        <StackedModalProvider onOpenChange={onStackedModalOpen}>
          <DrawerContent
            className={cn(
              stackedModalOpen && "bg-muted inset-y-5 right-5"
            )}
          >
            {children}
          </DrawerContent>
        </StackedModalProvider>
      </RouteModalProvider>
    </Drawer>
  )
}

const Header = DrawerHeader
const Title = DrawerTitle
const Description = DrawerDescription
const Body = ({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex-1 overflow-y-auto px-4", className)} {...props}>
    {children}
  </div>
)
const Footer = DrawerFooter
const Close = DrawerClose
const Form = RouteModalForm

export const RouteDrawer = Object.assign(Root, {
  Header,
  Title,
  Body,
  Description,
  Footer,
  Close,
  Form,
})
```

### Drawer Configuration

Both `RouteFocusModal` and `RouteDrawer` use the same shadcn `Drawer` -- the difference is:

| | RouteFocusModal | RouteDrawer |
|---|---|---|
| Direction | Bottom-up (`swipeDirection="down"`, default) | Right side (`swipeDirection="right"`) |
| Size | Near-full-screen (default max-height) | Fixed width (`w-[24rem]` default, customizable) |
| Use case | Create flows, complex forms | Edit flows, simple forms |
| Swipe to dismiss | Swipe down | Swipe right |
| Data attribute | `data-swipe-axis="y"` | `data-swipe-axis="x"` |

The shadcn Drawer defaults to `w-[24rem]` on `data-[swipe-axis=x]` for horizontal drawers. Customize width via className on `DrawerContent`.

### DrawerClose Behavior

The shadcn base-nova Drawer uses the `render` prop pattern from `@base-ui/react` for triggers and close buttons:

```tsx
<DrawerClose render={<Button variant="secondary" size="sm" />}>
  Cancel
</DrawerClose>
```

Or wrap it around children directly:

```tsx
<DrawerClose>
  <Button variant="secondary" size="sm">Cancel</Button>
</DrawerClose>
```

---

## RouteModalForm -- Unsaved Changes Guard (AlertDialog)

The most critical piece. Wraps `@tanstack/react-form`'s form instance and uses TanStack Router's `useBlocker` to show an **AlertDialog** confirmation when the user tries to navigate away with unsaved changes.

**Why AlertDialog?** The `@base-ui/react/alert-dialog` primitive cannot be dismissed via Escape or overlay click. The user MUST explicitly click Cancel or Continue. This prevents accidental data loss.

```tsx
// route-modal-form.tsx
import { PropsWithChildren } from "react"
import type { ReactFormExtendedApi } from "@tanstack/react-form"
import { useBlocker } from "@tanstack/react-router"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@proteus/ui"

type RouteModalFormProps<TFormData> = PropsWithChildren<{
  form: ReactFormExtendedApi<TFormData, any, any>
  blockSearchParams?: boolean
  onClose?: (isSubmitSuccessful: boolean) => void
}>

export const RouteModalForm = <TFormData,>({
  form,
  blockSearchParams: blockSearch = false,
  children,
  onClose,
}: RouteModalFormProps<TFormData>) => {
  const isDirty = form.useStore((s) => s.isDirty)

  const { proceed, reset, status } = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      // Check history state for successful submission flag
      const isSubmitSuccessful =
        (next.state as any)?.isSubmitSuccessful ||
        (window.history.state as any)?.isSubmitSuccessful

      if (isSubmitSuccessful) {
        onClose?.(true)
        return false // don't block
      }

      const isPathChanged = current.pathname !== next.pathname
      const isSearchChanged = current.searchStr !== next.searchStr

      if (isPathChanged) {
        onClose?.(false)
      }

      if (blockSearch) {
        return isDirty && (isPathChanged || isSearchChanged)
      }

      return isDirty && isPathChanged
    },
    withResolver: true,
    enableBeforeUnload: () => isDirty,
  })

  const handleCancel = () => {
    reset()
  }

  const handleContinue = () => {
    proceed()
    onClose?.(false)
  }

  return (
    <>
      {children}

      {/* Unsaved changes confirmation -- AlertDialog cannot be dismissed
          via Escape or overlay click, forcing explicit user action */}
      <AlertDialog open={status === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>You have unsaved changes</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave? Your unsaved changes will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleContinue}>
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
```

### Key Difference: TanStack Form vs react-hook-form

This project uses `@tanstack/react-form`, not `react-hook-form`. The key differences for the modal system:

| Concern | react-hook-form | @tanstack/react-form (our stack) |
|---|---|---|
| Form instance | `useForm()` returns `UseFormReturn` | `useAppForm()` returns `ReactFormExtendedApi` |
| Dirty state | `formState.isDirty` | `form.useStore((s) => s.isDirty)` |
| Form provider | `<FormProvider {...form}>` wraps children | Not needed -- form passed as prop or via context |
| Submit handler | `form.handleSubmit(fn)` | `form.handleSubmit` (no wrapper) |
| Field rendering | `register()` or `Controller` | `<form.AppField name="...">` with field context |
| Validation | `resolver: zodResolver(schema)` | `validators: { onSubmit: ZodSchema }` |

### Why AlertDialog for the Prompt

| Behavior | Drawer / Sheet | AlertDialog |
|---|---|---|
| Dismiss on Escape | Yes | **No** |
| Dismiss on overlay click | Yes | **No** |
| Dismiss on swipe | Yes | **No** |
| Requires explicit action | No | **Yes** |

AlertDialog forces the user to make an explicit choice (Cancel or Continue). This prevents accidentally discarding unsaved changes by clicking outside, pressing Escape, or swiping.

### Props

- **`form`**: The `ReactFormExtendedApi` from `@tanstack/react-form` (via `useAppForm`). Its `isDirty` store value drives the blocker.
- **`blockSearchParams`**: When `true`, also blocks navigation if only search params change (useful for media editing where tab switches change the URL).
- **`onClose`**: Called when the modal closes, receiving whether the submit was successful. Use for cleanup (e.g., invalidating queries).

### How the Blocker Works

1. `shouldBlockFn` receives `{ current, next }` with the current and next locations.
2. First checks for `isSubmitSuccessful` in the next location's state -- if found, allows navigation.
3. If `blockSearch` is false (default), only blocks when `isDirty && isPathChanged`.
4. If `blockSearch` is true, also blocks on search param changes.
5. `enableBeforeUnload` shows the browser's native "Leave page?" dialog when closing the tab/window with a dirty form.
6. `withResolver: true` enables the manual `proceed()`/`reset()` API for showing the AlertDialog.

---

## KeyboundForm -- Keyboard Shortcut Submit

Prevents accidental form submission on Enter. Requires `Cmd+Enter` (macOS) or `Ctrl+Enter` (Windows/Linux) to submit.

```tsx
// keybound-form.tsx
import React from "react"

export const KeyboundForm = React.forwardRef<
  HTMLFormElement,
  React.FormHTMLAttributes<HTMLFormElement>
>(({ onSubmit, onKeyDown, ...rest }, ref) => {
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit?.(event)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Enter") {
      // Allow normal newlines in textareas
      if (
        event.target instanceof HTMLTextAreaElement &&
        !(event.metaKey || event.ctrlKey)
      ) {
        return
      }

      event.preventDefault()

      // Only submit on Cmd/Ctrl+Enter
      if (event.metaKey || event.ctrlKey) {
        handleSubmit(event)
      }
    }
  }

  return (
    <form
      {...rest}
      onSubmit={handleSubmit}
      onKeyDown={onKeyDown ?? handleKeyDown}
      ref={ref}
    />
  )
})

KeyboundForm.displayName = "KeyboundForm"
```

### Behaviors

- **Plain Enter in text inputs**: does nothing (prevents accidental submission)
- **Cmd/Ctrl+Enter**: submits the form
- **Enter in textareas without modifier**: normal newline (not intercepted)
- **Custom `onKeyDown` prop**: overrides the default handler (used by multi-step forms to advance tabs instead of submitting)

---

## Stacked Modals (Modal-on-Modal)

For cases where you need a second modal on top of the first (e.g., picking related items while creating an entity). The shadcn Drawer has **built-in nested drawer support** -- when a nested drawer opens, the parent drawer automatically gets scale/opacity transitions via `data-nested-drawer-open` and `data-nested-drawer-swiping` data attributes.

### StackedModalProvider

Manages a `Record<string, boolean>` state map keyed by modal ID:

```tsx
// stacked-modal-provider.tsx
import { PropsWithChildren, useState } from "react"
import { StackedModalContext } from "./stacked-modal-context"

type StackedModalProviderProps = PropsWithChildren<{
  onOpenChange: (open: boolean) => void
}>

export const StackedModalProvider = ({
  children,
  onOpenChange,
}: StackedModalProviderProps) => {
  const [state, setState] = useState<Record<string, boolean>>({})

  const getIsOpen = (id: string) => state[id] || false

  const setIsOpen = (id: string, open: boolean) => {
    setState((prev) => ({ ...prev, [id]: open }))
    onOpenChange(open) // tells parent modal a stacked modal opened/closed
  }

  const register = (id: string) => {
    setState((prev) => ({ ...prev, [id]: false }))
  }

  const unregister = (id: string) => {
    setState((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  return (
    <StackedModalContext.Provider
      value={{ getIsOpen, setIsOpen, register, unregister }}
    >
      {children}
    </StackedModalContext.Provider>
  )
}
```

### Context and Hook

```tsx
// stacked-modal-context.tsx
import { createContext } from "react"

type StackedModalState = {
  getIsOpen: (id: string) => boolean
  setIsOpen: (id: string, open: boolean) => void
  register: (id: string) => void
  unregister: (id: string) => void
}

export const StackedModalContext = createContext<StackedModalState | null>(null)

// use-stacked-modal.ts
import { useContext } from "react"
import { StackedModalContext } from "./stacked-modal-context"

export const useStackedModal = () => {
  const context = useContext(StackedModalContext)
  if (!context) {
    throw new Error("useStackedModal must be used within a StackedModalProvider")
  }
  return context
}
```

### StackedFocusModal Component (Drawer)

Uses shadcn `Drawer` (bottom-up) nested inside the parent Drawer. The Drawer primitive handles the stacking visual automatically via its built-in nested drawer data attributes:

```tsx
// stacked-focus-modal.tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  cn,
} from "@proteus/ui"
import {
  ComponentPropsWithoutRef,
  PropsWithChildren,
  forwardRef,
  useEffect,
} from "react"
import { useStackedModal } from "../stacked-modal-provider"

type StackedFocusModalProps = PropsWithChildren<{
  id: string
  onOpenChangeCallback?: (open: boolean) => void
}>

const Root = ({ id, onOpenChangeCallback, children }: StackedFocusModalProps) => {
  const { register, unregister, getIsOpen, setIsOpen } = useStackedModal()

  useEffect(() => {
    register(id)
    return () => unregister(id)
  }, [])

  const handleOpenChange = (open: boolean) => {
    setIsOpen(id, open)
    onOpenChangeCallback?.(open)
  }

  return (
    <Drawer open={getIsOpen(id)} onOpenChange={handleOpenChange}>
      {children}
    </Drawer>
  )
}

const Content = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DrawerContent>
>(({ className, ...props }, ref) => (
  <DrawerContent
    ref={ref}
    className={cn("flex flex-col", className)}
    {...props}
  />
))
Content.displayName = "StackedFocusModal.Content"

export const StackedFocusModal = Object.assign(Root, {
  Close: DrawerClose,
  Header: DrawerHeader,
  Body: ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex-1 overflow-y-auto", className)} {...props}>
      {children}
    </div>
  ),
  Content,
  Footer: DrawerFooter,
  Title: DrawerTitle,
  Description: DrawerDescription,
})
```

### StackedDrawer Component (Drawer)

```tsx
// stacked-drawer.tsx
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  cn,
} from "@proteus/ui"
import {
  ComponentPropsWithoutRef,
  PropsWithChildren,
  forwardRef,
  useEffect,
} from "react"
import { useStackedModal } from "../stacked-modal-provider"

type StackedDrawerProps = PropsWithChildren<{
  id: string
}>

const Root = ({ id, children }: StackedDrawerProps) => {
  const { register, unregister, getIsOpen, setIsOpen } = useStackedModal()

  useEffect(() => {
    register(id)
    return () => unregister(id)
  }, [])

  return (
    <Drawer
      open={getIsOpen(id)}
      onOpenChange={(open) => setIsOpen(id, open)}
      swipeDirection="right"
    >
      {children}
    </Drawer>
  )
}

const Content = forwardRef<
  HTMLDivElement,
  ComponentPropsWithoutRef<typeof DrawerContent>
>(({ className, ...props }, ref) => (
  <DrawerContent
    ref={ref}
    className={cn(className)}
    {...props}
  />
))
Content.displayName = "StackedDrawer.Content"

export const StackedDrawer = Object.assign(Root, {
  Close: DrawerClose,
  Header: DrawerHeader,
  Body: ({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex-1 overflow-y-auto px-4", className)} {...props}>
      {children}
    </div>
  ),
  Content,
  Footer: DrawerFooter,
  Title: DrawerTitle,
  Description: DrawerDescription,
})
```

### Visual Treatment

The shadcn Drawer (base-nova) has built-in nested drawer stacking. When a nested `Drawer` opens inside another `Drawer`, the parent popup receives:
- `data-nested-drawer-open` -- triggers `overflow-hidden` and `brightness-95`
- `data-nested-drawer-swiping` -- restores opacity during swipe

This means the stacking visual (parent dims/shrinks, child appears on top) is handled by the Drawer CSS, not custom state. The `StackedModalProvider` state is still needed for imperative open/close control, but the visual treatment is automatic.

### Usage Example -- Item Picker Inside Create Form

**Parent form:**
```tsx
const PICKER_MODAL_ID = "item-picker"

export const CreateEntityOrganizeForm = ({ form }) => {
  return (
    <StackedFocusModal id={PICKER_MODAL_ID}>
      <div>
        <OrganizationSection form={form} />
      </div>
      <ItemPickerStackedModal form={form} />
    </StackedFocusModal>
  )
}
```

**The section that opens it:**
```tsx
const { setIsOpen } = useStackedModal()
<Button onClick={() => setIsOpen(PICKER_MODAL_ID, true)}>
  Add Items
</Button>
```

**The stacked modal content:**
```tsx
export const ItemPickerStackedModal = ({ form }) => {
  const { setIsOpen } = useStackedModal()
  const [rowSelection, setRowSelection] = useState({})

  const handleAdd = () => {
    form.setFieldValue("items", selectedItems)
    setIsOpen(PICKER_MODAL_ID, false)
  }

  return (
    <StackedFocusModal.Content>
      <StackedFocusModal.Header>
        <StackedFocusModal.Title>Select Items</StackedFocusModal.Title>
      </StackedFocusModal.Header>
      <StackedFocusModal.Body>
        <DataTable
          data={items}
          columns={columns}
          rowSelection={{ state: rowSelection, onRowSelectionChange: setRowSelection }}
        />
      </StackedFocusModal.Body>
      <StackedFocusModal.Footer>
        <StackedFocusModal.Close render={<Button variant="secondary" size="sm" />}>
          Cancel
        </StackedFocusModal.Close>
        <Button size="sm" onClick={handleAdd}>Save</Button>
      </StackedFocusModal.Footer>
    </StackedFocusModal.Content>
  )
}
```

---

## Route Masking for Modals

TanStack Router's **route masking** lets you navigate to a modal route (e.g., `/_authed/_shell/products/create`) while showing a cleaner URL in the address bar (e.g., `/products`). This is optional but useful for keeping URLs clean.

### How It Works

Route masking stores the real destination in `location.state.__tempLocation`. The router reads that instead of parsing the URL. When the URL is shared or the page is reloaded, the mask is gone and the clean URL is used.

### Declarative Approach (Recommended)

Define masks at the router level in `apps/admin/src/router.tsx`:

```tsx
import { createRouteMask, createRouter as createTanStackRouter } from "@tanstack/react-router"
import { routeTree } from "./routeTree.gen"

const createModalMask = createRouteMask({
  routeTree,
  from: "/_authed/_shell/products/create",
  to: "/products",
})

const editDrawerMask = createRouteMask({
  routeTree,
  from: "/_authed/_shell/products/$id/edit",
  to: "/products/$id",
  params: (prev) => ({ id: prev.id }),
})

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    routeMasks: [createModalMask, editDrawerMask],
  })

  return router
}
```

### Imperative Approach (Per-Link)

```tsx
import { Link } from "@tanstack/react-router"

<Link
  to="/_authed/_shell/products/create"
  mask={{ to: "/products" }}
>
  Create Product
</Link>
```

Or with `navigate`:

```tsx
const navigate = useNavigate()

navigate({
  to: "/_authed/_shell/products/create",
  mask: { to: "/products" },
})
```

### When to Use Route Masking

- **Use it** when you want modal URLs to look like the parent page
- **Skip it** when you want modal URLs to be shareable/bookmarkable
- **Use `unmaskOnReload: true`** when the modal shouldn't reopen on page refresh

---

## Search Param Preservation

When a modal opens from a list page with active filters, closing the modal should return to the same filtered view.

### TanStack Router Approach: Search Middlewares

Use `retainSearchParams` middleware on the parent route:

```tsx
// routes/_authed/_shell/products/route.tsx
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { retainSearchParams } from "@tanstack/react-router"
import { z } from "zod/v4"

const searchSchema = z.object({
  page: z.number().default(1),
  filter: z.string().default(""),
  sort: z.enum(["newest", "oldest", "price"]).default("newest"),
})

export const Route = createFileRoute("/_authed/_shell/products")({
  staticData: { breadcrumb: "Products" },
  validateSearch: searchSchema,
  search: {
    middlewares: [retainSearchParams(["page", "filter", "sort"])],
  },
  component: () => <Outlet />,
})
```

With `retainSearchParams`, child routes (including modal routes) automatically preserve the parent's search params in the URL. No custom hook needed.

### Alternative: Custom Hook Approach

If you need more control (e.g., restoring params from state):

```tsx
// use-search-aware-to.tsx
import { useMemo } from "react"
import { useLocation } from "@tanstack/react-router"

export const useSearchAwareTo = (prev: string | number) => {
  const location = useLocation()

  return useMemo(() => {
    if (typeof prev === "number") return prev

    const params = (location.state as any)?.restore_params
    if (params) return `${prev}?${params}`

    if (location.searchStr) return `${prev}${location.searchStr}`

    return prev
  }, [location.state, location.searchStr, prev])
}
```

---

## Multi-Step Form Pattern

Multi-step wizards use shadcn **`Tabs`** inside a `RouteFocusModal`. It's a **single route** with client-side tab state, not separate routes per step.

### Progress Tab Trigger

shadcn Tabs don't have a built-in progress indicator, so we extend `TabsTrigger` with a status badge. Add this to the admin app's components:

```tsx
// apps/admin/src/components/modals/progress-tabs-trigger.tsx
import { TabsTrigger, cn } from "@proteus/ui"
import { Circle, Check, Loader2 } from "lucide-react"

type ProgressStatus = "not-started" | "in-progress" | "completed"

type ProgressTabsTriggerProps = React.ComponentProps<typeof TabsTrigger> & {
  status: ProgressStatus
}

export const ProgressTabsTrigger = ({
  status,
  children,
  className,
  ...props
}: ProgressTabsTriggerProps) => {
  return (
    <TabsTrigger
      className={cn("gap-2", className)}
      {...props}
    >
      {status === "not-started" && (
        <Circle className="size-3 text-muted-foreground" />
      )}
      {status === "in-progress" && (
        <Loader2 className="size-3 animate-spin text-primary" />
      )}
      {status === "completed" && (
        <Check className="size-3 text-primary" />
      )}
      {children}
    </TabsTrigger>
  )
}
```

### Tab State Management

```tsx
enum Tab {
  DETAILS = "details",
  ORGANIZE = "organize",
  VARIANTS = "variants",
  INVENTORY = "inventory", // conditionally shown
}

type ProgressStatus = "not-started" | "in-progress" | "completed"
type TabState = Record<Tab, ProgressStatus>
```

### Complete Multi-Step Form

Uses `useAppForm` from `#/lib/form-hook.ts` (the project's form hook with registered field components):

```tsx
import { Button, Tabs, TabsContent, TabsList } from "@proteus/ui"
import { useAppForm } from "#/lib/form-hook.ts"
import { ProgressTabsTrigger } from "#/components/modals/progress-tabs-trigger"

export const CreateEntityForm = ({ regions, store }) => {
  const [tab, setTab] = useState<Tab>(Tab.DETAILS)
  const [tabState, setTabState] = useState<TabState>({
    [Tab.DETAILS]: "in-progress",
    [Tab.ORGANIZE]: "not-started",
    [Tab.VARIANTS]: "not-started",
    [Tab.INVENTORY]: "not-started",
  })

  const { handleSuccess } = useRouteModal()
  const { mutateAsync, isPending } = useCreateEntity()

  const form = useAppForm({
    defaultValues: FORM_DEFAULTS,
    validators: { onSubmit: CreateSchema },
    onSubmit: async ({ value }) => {
      await mutateAsync(value, {
        onSuccess: (data) => {
          toast.success("Created successfully")
          handleSuccess(`../${data.id}`)
        },
        onError: (error) => toast.error(error.message),
      })
    },
  })

  // --- Tab Navigation with Validation ---

  const onNext = async (currentTab: Tab) => {
    const valid = await form.validate("change")
    if (!valid) return

    if (currentTab === Tab.DETAILS) setTab(Tab.ORGANIZE)
    if (currentTab === Tab.ORGANIZE) setTab(Tab.VARIANTS)
    if (currentTab === Tab.VARIANTS) setTab(Tab.INVENTORY)
  }

  // --- Progress Indicators ---

  useEffect(() => {
    const current = { ...tabState }
    if (tab === Tab.DETAILS) {
      current[Tab.DETAILS] = "in-progress"
    }
    if (tab === Tab.ORGANIZE) {
      current[Tab.DETAILS] = "completed"
      current[Tab.ORGANIZE] = "in-progress"
    }
    if (tab === Tab.VARIANTS) {
      current[Tab.DETAILS] = "completed"
      current[Tab.ORGANIZE] = "completed"
      current[Tab.VARIANTS] = "in-progress"
    }
    if (tab === Tab.INVENTORY) {
      current[Tab.DETAILS] = "completed"
      current[Tab.ORGANIZE] = "completed"
      current[Tab.VARIANTS] = "completed"
      current[Tab.INVENTORY] = "in-progress"
    }
    setTabState({ ...current })
  }, [tab])

  // --- Conditional Tab ---

  const showInventoryTab = form.useStore((s) => {
    const variants = s.values.variants ?? []
    return variants.some((v) => v.manage_inventory && v.inventory_kit)
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (e.target instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey)) return
            e.preventDefault()
            if (e.metaKey || e.ctrlKey) {
              if (tab !== Tab.VARIANTS) {
                e.stopPropagation()
                onNext(tab)
                return
              }
              form.handleSubmit()
            }
          }
        }}
        onSubmit={(e) => {
          e.preventDefault()
          form.handleSubmit()
        }}
        className="flex h-full flex-col"
      >
        {/* shadcn Tabs with progress indicators */}
        <Tabs
          value={tab}
          onValueChange={async (tab) => {
            const valid = await form.validate("change")
            if (!valid) return
            setTab(tab as Tab)
          }}
          className="flex h-full flex-col overflow-hidden"
        >
          <RouteFocusModal.Header>
            <div className="-my-2 w-full border-l">
              <TabsList variant="line">
                <ProgressTabsTrigger status={tabState[Tab.DETAILS]} value={Tab.DETAILS}>
                  Details
                </ProgressTabsTrigger>
                <ProgressTabsTrigger status={tabState[Tab.ORGANIZE]} value={Tab.ORGANIZE}>
                  Organize
                </ProgressTabsTrigger>
                <ProgressTabsTrigger status={tabState[Tab.VARIANTS]} value={Tab.VARIANTS}>
                  Variants
                </ProgressTabsTrigger>
                {showInventoryTab && (
                  <ProgressTabsTrigger status={tabState[Tab.INVENTORY]} value={Tab.INVENTORY}>
                    Inventory
                  </ProgressTabsTrigger>
                )}
              </TabsList>
            </div>
          </RouteFocusModal.Header>

          <RouteFocusModal.Body className="size-full overflow-hidden">
            <TabsContent className="size-full overflow-y-auto" value={Tab.DETAILS}>
              <DetailsForm form={form} />
            </TabsContent>
            <TabsContent className="size-full overflow-y-auto" value={Tab.ORGANIZE}>
              <OrganizeForm form={form} />
            </TabsContent>
            <TabsContent className="size-full overflow-y-auto" value={Tab.VARIANTS}>
              <VariantsForm form={form} store={store} regions={regions} />
            </TabsContent>
            {showInventoryTab && (
              <TabsContent className="size-full overflow-y-auto" value={Tab.INVENTORY}>
                <InventoryForm form={form} />
              </TabsContent>
            )}
          </RouteFocusModal.Body>
        </Tabs>

        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
            Cancel
          </RouteFocusModal.Close>
          <PrimaryButton tab={tab} next={onNext} isLoading={isPending} showInventoryTab={showInventoryTab} />
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}

const PrimaryButton = ({ tab, next, isLoading, showInventoryTab }) => {
  const isLastTab =
    (tab === Tab.VARIANTS && !showInventoryTab) ||
    (tab === Tab.INVENTORY && showInventoryTab)

  if (isLastTab) {
    return (
      <Button type="submit" size="sm" disabled={isLoading}>
        Publish
      </Button>
    )
  }

  return (
    <Button type="button" size="sm" onClick={() => next(tab)}>
      Continue
    </Button>
  )
}
```

### Component Tree

```
RouteFocusModal (shadcn Drawer bottom-up -- opens on /products/create)
└── RouteFocusModal.Form (useBlocker + shadcn AlertDialog for unsaved changes)
    └── KeyboundForm (Cmd+Enter handling)
        └── shadcn Tabs (controlled value + onValueChange with validation gate)
            ├── RouteFocusModal.Header
            │   └── TabsList variant="line"
            │       └── ProgressTabsTrigger (extended TabsTrigger with status icons)
            ├── RouteFocusModal.Body
            │   └── TabsContent (per-tab forms using form.AppField)
            │       └── StackedFocusModal (shadcn Drawer bottom-up -- e.g. item picker)
            │           └── StackedFocusModal.Content (DataTable with selection)
            └── RouteFocusModal.Footer (Cancel / Continue|Publish)
```

---

## Route Definitions

### File-Based Routes

Routes live under `apps/admin/src/routes/` and use TanStack Router's layout group convention (`_authed`, `_shell` prefixed with underscore):

```
apps/admin/src/routes/
├── __root.tsx
├── _authed/
│   ├── route.tsx                        # Auth guard
│   ├── _shell/
│   │   ├── route.tsx                    # Shell layout (sidebar + breadcrumbs)
│   │   ├── index.tsx
│   │   ├── products/
│   │   │   ├── route.tsx                # Layout with <Outlet /> for modals
│   │   │   ├── index.tsx                # Product list page
│   │   │   ├── create.tsx               # RouteFocusModal (Drawer bottom-up)
│   │   │   ├── import.tsx               # RouteFocusModal (Drawer bottom-up)
│   │   │   ├── $id/
│   │   │   │   ├── route.tsx            # Detail layout with <Outlet />
│   │   │   │   ├── index.tsx            # Product detail page
│   │   │   │   ├── edit.tsx             # RouteDrawer (Drawer right)
│   │   │   │   ├── media.tsx            # RouteFocusModal (Drawer bottom-up)
│   │   │   │   └── prices.tsx           # RouteFocusModal (Drawer bottom-up)
│   │   ├── customers.tsx
│   │   └── ...
│   └── settings/
│       ├── route.tsx
│       └── store.tsx
└── _public/
    ├── route.tsx
    └── login.tsx
```

### Route Files

**Parent layout** (`routes/_authed/_shell/products/route.tsx`):

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/_shell/products")({
  staticData: { breadcrumb: "Products" },
  component: () => <Outlet />,
})
```

**List page** (`routes/_authed/_shell/products/index.tsx`):

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/_authed/_shell/products/")({
  component: ProductList,
})

function ProductList() {
  return (
    <div>
      <h1>Products</h1>
      <ProductTable />
      {/* Outlet renders the modal child route */}
      <Outlet />
    </div>
  )
}
```

**Create modal** (`routes/_authed/_shell/products/create.tsx`):

```tsx
import { createFileRoute } from "@tanstack/react-router"
import { RouteFocusModal } from "#/components/modals"

export const Route = createFileRoute("/_authed/_shell/products/create")({
  component: ProductCreate,
})

function ProductCreate() {
  return (
    <RouteFocusModal>
      <RouteFocusModal.Title className="sr-only">Create Product</RouteFocusModal.Title>
      <CreateProductForm />
    </RouteFocusModal>
  )
}
```

**Edit drawer** (`routes/_authed/_shell/products/$id/edit.tsx`):

```tsx
import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { RouteDrawer } from "#/components/modals"
import { productQueryOptions } from "#/features/products/api/products"

export const Route = createFileRoute("/_authed/_shell/products/$id/edit")({
  component: ProductEdit,
})

function ProductEdit() {
  const { id } = Route.useParams()
  const { data } = useSuspenseQuery(productQueryOptions(id))

  return (
    <RouteDrawer>
      <EditProductForm product={data.product} />
    </RouteDrawer>
  )
}
```

**Detail layout** (`routes/_authed/_shell/products/$id/route.tsx`) -- already exists:

```tsx
import { createFileRoute, Outlet } from "@tanstack/react-router"
import { productQueryOptions } from "#/features/products/api/products"

export const Route = createFileRoute("/_authed/_shell/products/$id")({
  beforeLoad: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(productQueryOptions(params.id))
    return { breadcrumb: data.product.title }
  },
  component: () => <Outlet />,
})
```

---

## Complete Usage Patterns

### Simple Create (RouteFocusModal)

```tsx
import { Button, cn } from "@proteus/ui"
import { useAppForm } from "#/lib/form-hook.ts"
import { RouteFocusModal, KeyboundForm, useRouteModal } from "#/components/modals"
import { useCreateShippingProfile } from "#/features/shipping/api/profiles"

function CreateShippingProfileForm() {
  const { handleSuccess } = useRouteModal()
  const { mutateAsync, isPending } = useCreateShippingProfile()

  const form = useAppForm({
    defaultValues: { name: "", type: "" },
    validators: { onSubmit: CreateProfileSchema },
    onSubmit: async ({ value }) => {
      await mutateAsync(value, {
        onSuccess: ({ shippingProfile }) => {
          toast.success("Created successfully")
          handleSuccess(`/settings/shipping-profiles/${shippingProfile.id}`)
        },
        onError: (error) => toast.error(error.message),
      })
    },
  })

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm
        onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
        className="flex h-full flex-col"
      >
        <RouteFocusModal.Header>
          <RouteFocusModal.Title>Create Shipping Profile</RouteFocusModal.Title>
        </RouteFocusModal.Header>
        <RouteFocusModal.Body>
          <div className="mx-auto max-w-[720px] py-16">
            <div className="grid grid-cols-2 gap-4">
              <form.AppField name="name">
                {(field) => <field.TextField label="Name" placeholder="Profile name" />}
              </form.AppField>
              <form.AppField name="type">
                {(field) => <field.TextField label="Type" placeholder="Profile type" />}
              </form.AppField>
            </div>
          </div>
        </RouteFocusModal.Body>
        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>
            Cancel
          </RouteFocusModal.Close>
          <Button type="submit" size="sm" disabled={isPending}>Save</Button>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}
```

### Simple Edit (RouteDrawer)

```tsx
import { Button } from "@proteus/ui"
import { useAppForm } from "#/lib/form-hook.ts"
import { RouteDrawer, KeyboundForm, useRouteModal } from "#/components/modals"
import { useUpdateUser } from "#/features/users/api/users"

function EditUserForm({ user }) {
  const { handleSuccess } = useRouteModal()
  const { mutateAsync, isPending } = useUpdateUser(user.id)

  const form = useAppForm({
    defaultValues: { first_name: user.first_name ?? "", last_name: user.last_name ?? "" },
    validators: { onSubmit: EditUserSchema },
    onSubmit: async ({ value }) => {
      await mutateAsync(value, {
        onSuccess: () => handleSuccess(),
      })
    },
  })

  return (
    <RouteDrawer.Form form={form}>
      <KeyboundForm
        onSubmit={(e) => { e.preventDefault(); form.handleSubmit() }}
        className="flex flex-1 flex-col"
      >
        <RouteDrawer.Header>
          <RouteDrawer.Title>Edit User</RouteDrawer.Title>
        </RouteDrawer.Header>
        <RouteDrawer.Body>
          <form.AppField name="first_name">
            {(field) => <field.TextField label="First name" />}
          </form.AppField>
          <form.AppField name="last_name">
            {(field) => <field.TextField label="Last name" />}
          </form.AppField>
        </RouteDrawer.Body>
        <RouteDrawer.Footer>
          <RouteDrawer.Close render={<Button variant="secondary" size="sm" />}>
            Cancel
          </RouteDrawer.Close>
          <Button type="submit" size="sm" disabled={isPending}>Save</Button>
        </RouteDrawer.Footer>
      </KeyboundForm>
    </RouteDrawer.Form>
  )
}
```

---

## Feature Summary

| Feature | shadcn Component | Mechanism |
|---|---|---|
| Full-screen create modal | `Drawer` (`@base-ui/react/drawer`) | Bottom-up Drawer covering near-full screen |
| Side panel edit modal | `Drawer` (`@base-ui/react/drawer`) | Route-driven Drawer with `swipeDirection="right"` |
| Entry/exit animations | `Drawer` built-in | CSS transitions, `open` state deferred to `true` on mount |
| Unsaved changes prompt | `AlertDialog` (`@base-ui/react/alert-dialog`) | `useBlocker` with `withResolver: true` + AlertDialog |
| Browser tab close guard | -- | `enableBeforeUnload` option on `useBlocker` |
| Bypass prompt on success | -- | `handleSuccess()` sets `isSubmitSuccessful` in history state |
| Search param preservation | -- | `retainSearchParams` middleware on parent route |
| URL masking | -- | `createRouteMask` hides modal route from URL bar |
| Cmd+Enter to submit | -- | `KeyboundForm` prevents bare Enter, requires modifier key |
| Escape key control | `Drawer` | `onKeyDown` handler on `DrawerContent` prevents Escape |
| Stacked modals | `Drawer` | `StackedModalProvider` + Drawer's built-in nested support |
| Stacked modal dimming | `Drawer` built-in | `data-nested-drawer-open` triggers `brightness-95` |
| Multi-step wizard | `Tabs` (`@base-ui/react/tabs`) | shadcn Tabs with `ProgressTabsTrigger` inside RouteFocusModal |
| Conditional tabs | -- | `form.useStore()` to reactively show/hide tabs |
| Form fields | -- | `form.AppField` + registered field components (TextField, etc.) |
| Form dirty tracking | -- | `form.useStore((s) => s.isDirty)` from `@tanstack/react-form` |
| Parent page stays mounted | -- | `<Outlet />` renders modal alongside page content |
| Type-safe search params | -- | `validateSearch` with Zod v4 schema on route definition |

### Data Flow: Full Lifecycle

**Opening:**
1. User navigates to child route (e.g., `/_authed/_shell/products/create`).
2. TanStack Router renders the child route inside the parent's `<Outlet />`.
3. `Root` mounts with `open=false`; `useEffect` sets `open=true` -- Drawer animates in.
4. `RouteModalProvider` is created with `handleSuccess` callback.
5. `RouteModalForm` registers a `useBlocker`.

**Submitting successfully:**
1. Form calls `mutateAsync` (via `form.onSubmit`).
2. On success, calls `handleSuccess("../some-id")`.
3. `handleSuccess` calls `navigate({ to: "../some-id", replace: true, state: { isSubmitSuccessful: true } })`.
4. `shouldBlockFn` fires, sees `isSubmitSuccessful: true`, returns `false`.
5. Navigation proceeds; Drawer unmounts.

**Closing with unsaved changes:**
1. User clicks Close, presses Escape, or navigates away.
2. `handleOpenChange(false)` calls `navigate({ to: "..", replace: true })`.
3. `shouldBlockFn` fires, sees `isDirty=true` and path changed, returns `true`.
4. `status === "blocked"` -- AlertDialog renders (cannot dismiss via Escape/overlay).
5. User clicks "Cancel" -- `reset()` -- modal stays open.
6. User clicks "Continue" -- `proceed()` -- navigation completes, Drawer unmounts.

**Stacked modal flow:**
1. Child calls `setIsOpen("picker-id", true)` via `useStackedModal()`.
2. `StackedModalProvider` calls `onStackedModalOpen(true)`.
3. Parent Drawer automatically receives `data-nested-drawer-open`, dimming/shrinking via CSS.
4. Stacked Drawer opens on top with its own overlay.
5. When done, `setIsOpen("picker-id", false)` reverses the visual treatment.
