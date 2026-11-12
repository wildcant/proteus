import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { cn } from '@proteus/ui-core'
import type { VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import {
  alertDialog,
  alertDialogAction,
  alertDialogActionLabel,
  alertDialogCancel,
  alertDialogCancelLabel,
  alertDialogDescription,
  alertDialogFooter,
  alertDialogHeader,
  alertDialogTitle,
} from '#/components/ui/alert-dialog/alert-dialog.variants'
import { alertDialogOverlay } from '#/components/ui/alert-dialog-overlay/alert-dialog-overlay.variants'

/** The buttons' mechanics; their look, focus included, is the set's `action` and `cancel` layers. */
const buttonBehaviour =
  'shrink-0 select-none whitespace-nowrap bg-clip-padding outline-none transition-all active:translate-y-px disabled:pointer-events-none'

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
  return <AlertDialogPrimitive.Portal data-slot="alert-dialog-portal" {...props} />
}

function AlertDialogOverlay({ className, ...props }: AlertDialogPrimitive.Backdrop.Props) {
  return (
    <AlertDialogPrimitive.Backdrop
      data-slot="alert-dialog-overlay"
      className={cn(
        alertDialogOverlay(),
        'data-open:fade-in-0 data-closed:fade-out-0 fixed inset-0 isolate z-50 duration-100 data-closed:animate-out data-open:animate-in',
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({ className, ...props }: AlertDialogPrimitive.Popup.Props) {
  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Popup
        data-slot="alert-dialog-content"
        className={cn(
          alertDialog(),
          'group/alert-dialog-content data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none duration-100 data-closed:animate-out data-open:animate-in',
          className,
        )}
        {...props}
      />
    </AlertDialogPortal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-dialog-header" className={cn(alertDialogHeader(), className)} {...props} />
}

/** Cancel comes first in the DOM, so on the phone, where the buttons stack, the action sits on top. */
function AlertDialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(alertDialogFooter(), 'max-sm:flex-col-reverse', className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: AlertDialogPrimitive.Title.Props) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn(alertDialogTitle(), className)}
      {...props}
    />
  )
}

/** Balanced lines: FigCraft has no text-wrap property, so the phone's line breaks are set here. */
function AlertDialogDescription({ className, ...props }: AlertDialogPrimitive.Description.Props) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn(alertDialogDescription(), 'text-balance md:text-pretty', className)}
      {...props}
    />
  )
}

type AlertDialogActionProps = React.ComponentProps<'button'> & VariantProps<typeof alertDialogAction>

/** `destructive` for a prompt that deletes; `default` for one that only moves on (discarding a draft). */
function AlertDialogAction({ className, type = 'button', variant, ...props }: AlertDialogActionProps) {
  return (
    <button
      data-slot="alert-dialog-action"
      type={type}
      className={cn(alertDialogAction({ variant }), alertDialogActionLabel({ variant }), buttonBehaviour, className)}
      {...props}
    />
  )
}

function AlertDialogCancel({ className, ...props }: AlertDialogPrimitive.Close.Props) {
  return (
    <AlertDialogPrimitive.Close
      data-slot="alert-dialog-cancel"
      className={cn(alertDialogCancel(), alertDialogCancelLabel(), buttonBehaviour, className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
}
