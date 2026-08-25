import React from 'react'

/**
 * Form wrapper that prevents accidental submission on bare Enter.
 *
 * - Plain Enter in text inputs: suppressed (no accidental submit)
 * - Cmd+Enter (macOS) / Ctrl+Enter (Windows/Linux): submits via `requestSubmit()`
 * - Enter in `<textarea>` without modifier: allowed (normal newline)
 * - Custom `onKeyDown` prop: overrides the default handler entirely
 */
type KeyboundFormProps = React.ComponentProps<'form'>

export const KeyboundForm = React.forwardRef<HTMLFormElement, KeyboundFormProps>(
  ({ onSubmit, onKeyDown, ...rest }, ref) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
      if (event.key === 'Enter') {
        if (event.target instanceof HTMLTextAreaElement && !(event.metaKey || event.ctrlKey)) {
          return
        }

        event.preventDefault()

        if (event.metaKey || event.ctrlKey) {
          event.currentTarget.requestSubmit()
        }
      }
    }

    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault()
      onSubmit?.(event)
    }

    return <form {...rest} onSubmit={handleSubmit} onKeyDown={onKeyDown ?? handleKeyDown} ref={ref} />
  },
)

KeyboundForm.displayName = 'KeyboundForm'
