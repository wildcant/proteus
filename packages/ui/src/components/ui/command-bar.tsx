import * as React from 'react'
import { cn } from '#/lib/utils.ts'

/** Commands only listen for their shortcut while the bar is open. */
const CommandBarOpenContext = React.createContext(false)

type CommandBarProps = React.ComponentProps<'div'> & {
  open?: boolean
}

/**
 * A floating bar pinned to the bottom of the viewport, used to act on a selection.
 *
 * Stays mounted while closed so it can animate in and out; pointer events and
 * keyboard shortcuts are disabled in that state.
 */
function CommandBar({ open = false, className, children, ...props }: CommandBarProps) {
  return (
    <CommandBarOpenContext.Provider value={open}>
      <div
        data-slot="command-bar"
        data-state={open ? 'open' : 'closed'}
        aria-hidden={!open}
        className={cn(
          'fixed bottom-8 left-1/2 z-50 -translate-x-1/2 transition duration-150',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0',
        )}
      >
        <div
          className={cn(
            'relative flex items-center overflow-hidden rounded-full bg-primary px-1 text-primary-foreground shadow-lg',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    </CommandBarOpenContext.Provider>
  )
}

/** Describes what the commands will act on, e.g. "3 selected". */
function CommandBarValue({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="command-bar-value"
      className={cn('px-3 py-2.5 font-medium text-primary-foreground/70 text-sm', className)}
      {...props}
    />
  )
}

function CommandBarSeparator({ className, ...props }: Omit<React.ComponentProps<'div'>, 'children'>) {
  return (
    <div data-slot="command-bar-separator" className={cn('h-10 w-px bg-primary-foreground/20', className)} {...props} />
  )
}

type CommandBarCommandProps = Omit<React.ComponentProps<'button'>, 'children' | 'onClick'> & {
  action: () => void | Promise<void>
  label: string
  /** Single key that triggers the action while the bar is open. */
  shortcut: string
}

function CommandBarCommand({
  className,
  type = 'button',
  label,
  action,
  shortcut,
  disabled,
  ...props
}: CommandBarCommandProps) {
  const open = React.useContext(CommandBarOpenContext)

  React.useEffect(() => {
    if (!open || disabled) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      // Typing the shortcut key into a field should insert the character, not fire the command.
      if (isTextEntryElement(document.activeElement)) {
        return
      }

      if (event.key.toLowerCase() !== shortcut.toLowerCase()) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      action()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, disabled, shortcut, action])

  return (
    <button
      data-slot="command-bar-command"
      type={type}
      disabled={disabled}
      onClick={() => action()}
      className={cn(
        'flex items-center gap-x-2 px-3 py-2.5 font-medium text-sm outline-none transition-colors',
        'hover:bg-primary-foreground/10 focus-visible:bg-primary-foreground/10 active:bg-primary-foreground/20',
        'disabled:pointer-events-none disabled:opacity-50',
        'last-of-type:-mr-1 last-of-type:pr-4',
        className,
      )}
      {...props}
    >
      <span>{label}</span>
      <kbd
        data-slot="kbd"
        className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1 font-mono text-[11px] text-primary-foreground/70"
      >
        {shortcut.toUpperCase()}
      </kbd>
    </button>
  )
}

function isTextEntryElement(element: Element | null) {
  if (!element) {
    return false
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    return true
  }

  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
}

export { CommandBar, CommandBarCommand, CommandBarSeparator, CommandBarValue }
