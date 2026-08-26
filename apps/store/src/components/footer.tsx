import { AmericanexpressIcon, type Icon, MastercardIcon, VisaIcon } from '@proteus/icons'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@proteus/ui'
import { Link } from '@tanstack/react-router'

/**
 * Every slot the storefront can actually back. A column is two or three real routes or it is
 * not here: a link that silently returns the shopper to the home page is a bug they walk into,
 * not a placeholder they can read. The legal column is the conspicuous absence — it waits on
 * `/terms`, `/privacy` and `/returns` existing.
 *
 * One constant feeds both the accordion and the static columns, so the two trees cannot drift.
 */
const footerColumns = [
  {
    title: 'Shop',
    links: [
      { label: 'Home', to: '/' as const },
      { label: 'All products', to: '/products' as const },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/login' as const },
      { label: 'Create account', to: '/signup' as const },
    ],
  },
]

/**
 * Full-colour card badges, which is the one place the ink/surface/accent palette is deliberately
 * broken: a scheme mark is only recognisable in its own colours, and a shopper scans this strip
 * for a logo rather than reading it. Each asset carries its own fills, so unlike every other mark
 * in `@proteus/icons` these do not tint and do not follow the colour scheme — a `text-*` class
 * here would be a no-op.
 *
 * They are 100x60 badges fitted onto the square icon grid, so they render 28x16.8 at `size={28}`.
 *
 * Aspirational today — `payment/providers/` holds only `system`, "Manual Payment", test-only — so
 * this strip has to be reconciled against the real provider list before the store takes money.
 */
const paymentMarks: { label: string; mark: Icon }[] = [
  { label: 'Visa', mark: VisaIcon },
  { label: 'Mastercard', mark: MastercardIcon },
  { label: 'American Express', mark: AmericanexpressIcon },
]

/**
 * Empty until there are accounts to link to, and the row renders nothing at all rather than
 * pointing marks at `#` or at a brand's logged-out home page. `@proteus/icons` already exports
 * the six marks this will use.
 */
const socialLinks: { label: string; href: string; mark: Icon }[] = []

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-line border-t bg-surface">
      <div className="mx-auto w-full max-w-350 px-4 pt-10 pb-14 sm:px-6 lg:px-8">
        {/* Two trees for the same links, switched by CSS alone. `spec.md` warns off structural
            breakpoint switches, and this is the sanctioned exception: the server renders both and
            the browser picks with no viewport detection and no first-paint flash, while
            `display: none` keeps the hidden one out of the accessibility tree. Five links stacked
            flat push the copyright most of a screen down, and the accordion cannot be talked into
            staying open above `sm` without fighting its own height variable. */}
        <Accordion className="sm:hidden">
          {footerColumns.map((column) => (
            <AccordionItem
              key={column.title}
              value={column.title}
              className="border-line border-t not-last:border-b-0 last:border-b"
            >
              <AccordionTrigger className="items-center py-5 text-ink **:data-[slot=accordion-trigger-icon]:size-5 **:data-[slot=accordion-trigger-icon]:text-ink">
                <span className="type-heading">{column.title}</span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 [&_a]:no-underline">
                <FooterLinks column={column} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className="hidden gap-8 sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {footerColumns.map((column) => (
            <div key={column.title}>
              <h3 className="type-heading m-0 mb-4 text-ink">{column.title}</h3>
              <FooterLinks column={column} />
            </div>
          ))}
        </div>

        {/* Social above payment on a phone, then the two on one baseline at opposite ends above
            `lg` — the reference's order, not the desktop row flowed narrow. `order` rather than
            `flex-row-reverse` so the payment strip still sits inline-start when social is empty. */}
        <div className="mt-10 flex flex-col items-center gap-6 lg:mt-14 lg:flex-row lg:justify-between">
          {socialLinks.length > 0 && (
            <ul className="order-1 m-0 flex list-none flex-wrap items-center justify-center p-0 lg:order-2">
              {socialLinks.map(({ label, href, mark: Mark }) => (
                <li key={label}>
                  {/* 44px target for a 20px mark. The mark stays untitled so the anchor's
                      `aria-label` is the one thing announced. */}
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="flex size-11 items-center justify-center text-ink-muted hover:text-ink"
                  >
                    <Mark size={20} />
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* Decorative — no `title`, so `@proteus/icons` renders each `aria-hidden`. They wrap
              rather than shrink; 24px is already the floor for a legible mark. */}
          <ul className="order-2 m-0 flex list-none flex-wrap items-center justify-center gap-3 p-0 lg:order-1">
            {paymentMarks.map(({ label, mark: Mark }) => (
              <li key={label} className="flex">
                <Mark size={28} />
              </li>
            ))}
          </ul>
        </div>

        {/* The only rule below the columns. The legal links slot in beside the copyright here
            once `/terms`, `/privacy` and `/returns` exist. */}
        <div className="mt-10 border-line border-t pt-6 lg:flex lg:items-center lg:justify-between">
          <p className="m-0 text-center text-ink-muted lg:text-left">&copy; {year} Proteus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}

function FooterLinks({ column }: { column: (typeof footerColumns)[number] }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {column.links.map((link) => (
        <li key={link.label}>
          <Link to={link.to} className="block py-1.5 text-ink-muted no-underline hover:text-ink">
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  )
}
