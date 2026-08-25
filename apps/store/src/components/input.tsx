import { cn, Input, Label } from '@proteus/ui'
import { EyeIcon, EyeOffIcon } from 'lucide-react'
import { type ComponentProps, useState } from 'react'
import { LabelText } from '#/components/form/label-text.tsx'

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

type FloatingLabelProps = ComponentProps<typeof Label>

/**
 * The label half. Rests centred over the field and floats to the top *inside* the box,
 * clear of the border rather than notched into it.
 *
 * `pointer-events-none` so a click on the resting label lands on the input beneath it.
 */
function FloatingLabel({ className, ...props }: FloatingLabelProps) {
  return (
    <Label
      className={cn(
        'pointer-events-none absolute left-4 origin-left text-ink-muted text-sm',
        'top-2.5 scale-[0.857]',
        'peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100',
        'peer-focus:top-2.5 peer-focus:translate-y-0 peer-focus:scale-[0.857]',
        'transition-[top,transform] duration-200 motion-reduce:transition-none',
        className,
      )}
      {...props}
    />
  )
}

type FloatingLabelInputProps = FloatingInputProps & {
  id: string
  label: string
}

export function FloatingLabelInput({
  id,
  label,
  type = 'text',
  className,
  required,
  ...props
}: FloatingLabelInputProps) {
  const [isRevealed, setIsRevealed] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className="relative">
      <FloatingInput
        id={id}
        // aria-required rather than the `required` attribute: the latter hands validation
        // to the browser, which would fire native bubbles alongside our own field errors.
        aria-required={required}
        type={isPassword && isRevealed ? 'text' : type}
        className={cn(isPassword && 'pr-12', className)}
        {...props}
      />
      <FloatingLabel htmlFor={id}>
        <LabelText required={required}>{label}</LabelText>
      </FloatingLabel>
      {!!isPassword && (
        <button
          type="button"
          onClick={() => setIsRevealed((revealed) => !revealed)}
          aria-label={isRevealed ? 'Hide password' : 'Show password'}
          className="absolute top-1/2 right-4 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2"
        >
          {isRevealed ? <EyeOffIcon className="size-5" /> : <EyeIcon className="size-5" />}
        </button>
      )}
    </div>
  )
}
