import { cn, Input } from '@proteus/ui'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { type ComponentProps, useState } from 'react'
import { FieldHelp } from '#/components/form/field-help.tsx'
import { FloatingLabel } from '#/components/form/floating-label.tsx'
import { LabelText } from '#/components/form/label-text.tsx'
import { TRAILING_CONTROL } from '#/components/form/trailing-control.ts'

type FloatingInputProps = Omit<ComponentProps<typeof Input>, 'placeholder'>

/**
 * The input half. `placeholder=" "` is load-bearing: `:placeholder-shown` is what tells
 * the label whether the field is filled, and unlike a change event it still fires when
 * the browser autofills.
 */
function FloatingInput({ className, ...props }: FloatingInputProps) {
  return (
    <Input
      placeholder=" "
      className={cn(
        // 16px on small screens so iOS does not zoom the page on focus.
        'peer h-14 px-4 pt-5 pb-1 text-base md:text-sm',
        'border-line focus-visible:border-ink focus-visible:ring-0 aria-invalid:border-sale aria-invalid:ring-0',
        className,
      )}
      {...props}
    />
  )
}

type FloatingLabelInputProps = FloatingInputProps & {
  id: string
  label: string
  /** A note about why the field is asked for, behind a `?` at the end of the field. */
  help?: string
}

export function FloatingLabelInput({
  id,
  label,
  help,
  type = 'text',
  className,
  required,
  ...props
}: FloatingLabelInputProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const isPassword = type === 'password'
  const trailingCount = (isPassword ? 1 : 0) + (help ? 1 : 0)

  return (
    <div className="relative">
      <FloatingInput
        id={id}
        // aria-required rather than the `required` attribute: the latter hands validation
        // to the browser, which would fire native bubbles alongside our own field errors.
        aria-required={required}
        type={isPassword && isRevealed ? 'text' : type}
        // Right padding clears the trailing gutter: 16px of it, plus a 20px icon per control
        // and the 12px between them.
        className={cn(trailingCount === 1 && 'pr-12', trailingCount === 2 && 'pr-20', className)}
        {...props}
      />
      {/* On top of `FloatingLabel`: rest centred while empty and unfocused, float on either. */}
      <FloatingLabel
        htmlFor={id}
        className={cn(
          'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100',
          'peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:scale-[0.857]',
          'transition-[top,transform] duration-200 motion-reduce:transition-none',
        )}
      >
        <LabelText required={required}>{label}</LabelText>
      </FloatingLabel>
      {trailingCount > 0 && (
        <div className="absolute top-1/2 right-4 flex -translate-y-1/2 items-center gap-3">
          {!!isPassword && (
            <button
              type="button"
              onClick={() => setIsRevealed((revealed) => !revealed)}
              aria-label={isRevealed ? 'Hide password' : 'Show password'}
              className={TRAILING_CONTROL}
            >
              {isRevealed ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
            </button>
          )}
          {!!help && <FieldHelp>{help}</FieldHelp>}
        </div>
      )}
    </div>
  )
}
