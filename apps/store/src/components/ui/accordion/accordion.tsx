import { Accordion as AccordionPrimitive } from '@base-ui/react/accordion'
import { cn } from '@proteus/ui-core'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { createContext, useContext } from 'react'
import {
  accordion,
  accordionContent,
  accordionIcon,
  accordionItem,
  accordionLabel,
  accordionTrigger,
} from '#/components/ui/accordion/accordion.variants'

/** `menu` is the side menu's rows, `section` a row nested inside one, `footer` the phone footer's link columns. */
type AccordionVariant = 'menu' | 'footer' | 'section'

/** Set once on the root, so an item, its trigger and its panel cannot disagree. */
const AccordionVariantContext = createContext<AccordionVariant>('menu')

type AccordionProps = AccordionPrimitive.Root.Props & { variant?: AccordionVariant }

export function Accordion({ className, variant = 'menu', ...props }: AccordionProps) {
  return (
    <AccordionVariantContext value={variant}>
      <AccordionPrimitive.Root data-slot="accordion" className={cn(accordion(), className)} {...props} />
    </AccordionVariantContext>
  )
}

export function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
  const variant = useContext(AccordionVariantContext)

  return (
    <AccordionPrimitive.Item
      data-slot="accordion-item"
      className={cn(accordionItem({ variant }), className)}
      {...props}
    />
  )
}

/** The label is the set's `label`; the plus turns to a minus while the item is open. */
export function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.Trigger.Props) {
  const variant = useContext(AccordionVariantContext)

  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          accordionTrigger({ variant }),
          'group/accordion-trigger flex-1 text-left outline-none transition-all aria-disabled:pointer-events-none',
          className,
        )}
        {...props}
      >
        <span className={accordionLabel({ variant })}>{children}</span>
        <PlusIcon
          aria-hidden="true"
          className={cn(accordionIcon(), 'pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden')}
        />
        <MinusIcon
          aria-hidden="true"
          className={cn(
            accordionIcon(),
            'pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline',
          )}
        />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

/** The panel animates its own height from Base UI's measured `--accordion-panel-height`. */
export function AccordionContent({ className, children, ...props }: AccordionPrimitive.Panel.Props) {
  const variant = useContext(AccordionVariantContext)

  return (
    <AccordionPrimitive.Panel
      data-slot="accordion-content"
      className="overflow-hidden data-closed:animate-accordion-up data-open:animate-accordion-down"
      {...props}
    >
      <div className={cn(accordionContent({ variant }), className)}>{children}</div>
    </AccordionPrimitive.Panel>
  )
}
