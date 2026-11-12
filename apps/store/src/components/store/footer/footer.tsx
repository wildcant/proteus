import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from '@proteus/ui-core'
import type { ComponentType, ReactNode } from 'react'
import { MenuLink, type MenuLinkTo } from '#/components/header/menu'
import { type MenuSource, resolveMenuItems } from '#/components/header/menu-items'
import {
  footer,
  footerAccordion,
  footerAccordionItem,
  footerAccordionLastItem,
  footerBottom,
  footerColumn,
  footerColumns,
  footerContainer,
  footerCopyright,
  footerLink,
  footerLinkLabel,
  footerLinks,
  footerMarketSelect,
  footerMarks,
  footerPayments,
  footerTitle,
} from '#/components/store/footer/footer.variants'
import { MarketSelect } from '#/components/store/market-select/market-select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '#/components/ui/accordion/accordion'
import type { LinkTarget } from '#/lib/link-target'

/**
 * Every slot the storefront can actually back. A column is two or three real routes or it is
 * not here: a link that silently returns the shopper to the home page is a bug they walk into,
 * not a placeholder they can read. The legal column is the conspicuous absence — it waits on
 * `/terms`, `/privacy` and `/returns` existing.
 *
 * The Shop column is "Shop all" and the top level of the store's menu — the same entries the header
 * carries, flat — rather than named here. One list feeds both the accordion and the static
 * columns, so the two trees cannot drift.
 */
type FooterLink = { key: string; label: string; link: LinkTarget }
type FooterColumn = { title: string; links: FooterLink[] }

/** The `Root` screen's ways out that the footer carries, from the flow map, which the `_main` layout hands it. */
export type FooterLinkTargets = { menu: MenuLinkTo; signIn: LinkTarget; createAccount: LinkTarget }

function useFooterColumns(menu: MenuSource, links: FooterLinkTargets): FooterColumn[] {
  const { t } = useLingui()

  return [
    {
      title: t`Shop`,
      links: [
        { key: 'shop-all', label: t`Shop all`, link: links.menu() },
        ...resolveMenuItems(menu).map(({ key, label, target }) => ({ key, label, link: links.menu(target) })),
      ],
    },
    {
      title: t`Account`,
      links: [
        { key: 'sign-in', label: t`Sign in`, link: links.signIn },
        { key: 'create-account', label: t`Create account`, link: links.createAccount },
      ],
    },
  ]
}

/**
 * Full-colour card badges, which is the one place the ink/surface/accent palette is deliberately
 * broken: a scheme mark is only recognisable in its own colours, and a shopper scans this strip
 * for a logo rather than reading it. Each asset carries its own fills, so unlike every icon these
 * do not tint and do not follow the colour scheme — a `text-*` class here would be a no-op.
 *
 * The artwork is the payment-method entity's, which shared chrome may not import, so the layout
 * route fills `renderPaymentMark` with it. The badges are 100x60 fitted onto a square grid, and the
 * route renders them 28x16.8 in a 28 square.
 *
 * Aspirational today — `payment/providers/` holds only `system`, "Manual Payment", test-only — so
 * this strip has to be reconciled against the real provider list before the store takes money.
 */
const paymentNetworks = ['visa', 'mastercard', 'amex']

/**
 * Empty until there are accounts to link to, and the row renders nothing at all rather than
 * pointing marks at `#` or at a brand's logged-out home page.
 */
const socialLinks: { label: string; href: string; mark: ComponentType<{ size: number }> }[] = []

/** `menu` is read by the layout route: shared chrome may not import the feature. */
export function Footer({
  menu,
  links,
  renderPaymentMark,
}: {
  menu: MenuSource
  links: FooterLinkTargets
  renderPaymentMark: (network: string) => ReactNode
}) {
  const columns = useFooterColumns(menu, links)
  const year = new Date().getFullYear()

  return (
    // `mt-20` is the gap above it on every page; `mx-auto w-full` centres the capped container,
    // which the design file draws as stretched.
    <footer className={cn(footer(), 'mt-20')}>
      <div className={cn(footerContainer(), 'mx-auto w-full')}>
        {/* Two trees for the same links, switched by CSS alone. `spec.md` warns off structural
            breakpoint switches, and this is the sanctioned exception: the server renders both and
            the browser picks with no viewport detection and no first-paint flash, while
            `display: none` keeps the hidden one out of the accessibility tree. Five links stacked
            flat push the copyright most of a screen down, and the accordion cannot be talked into
            staying open above `sm` without fighting its own height variable. */}
        <Accordion variant="footer" className={footerAccordion()}>
          {columns.map((column, index) => (
            <AccordionItem
              key={column.title}
              value={column.title}
              className={index === columns.length - 1 ? footerAccordionLastItem() : footerAccordionItem()}
            >
              <AccordionTrigger>{column.title}</AccordionTrigger>
              <AccordionContent>
                <FooterLinks column={column} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <div className={footerColumns()}>
          {columns.map((column) => (
            <div key={column.title} className={footerColumn()}>
              <h3 className={cn(footerTitle(), 'm-0')}>{column.title}</h3>
              <FooterLinks
                column={column}
                className={footerLinks()}
                linkClassName={cn(footerLink(), footerLinkLabel())}
              />
            </div>
          ))}
        </div>

        {/* Social above payment on a phone, then the two on one baseline at opposite ends above
            `lg` — the reference's order, not the desktop row flowed narrow. `order` rather than
            `flex-row-reverse` so the payment strip still sits inline-start when social is empty. */}
        <div className={footerMarks()}>
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

          {/* Decorative — the route's marks are untitled, so each renders `aria-hidden`. They wrap
              rather than shrink; 24px is already the floor for a legible mark. */}
          <ul className={cn(footerPayments(), 'order-2 m-0 list-none flex-wrap justify-center p-0 lg:order-1')}>
            {paymentNetworks.map((network) => (
              <li key={network} className="flex">
                {renderPaymentMark(network)}
              </li>
            ))}
          </ul>
        </div>

        {/* The only rule below the columns. The legal links slot in beside the copyright here
            once `/terms`, `/privacy` and `/returns` exist.

            The market control lives on this bar rather than in the header because it belongs with
            the store's other standing facts, and because it is the one place that renders at every
            width without competing for the header's flanks. */}
        <div className={footerBottom()}>
          <p className={cn(footerCopyright(), 'm-0')}>
            <Trans>&copy; {year} Proteus. All rights reserved.</Trans>
          </p>
          <MarketSelect className={footerMarketSelect()} />
        </div>
      </div>
    </footer>
  )
}

/** The accordion's links are the accordion set's content; the columns' are the footer's own layers. */
function FooterLinks({
  column,
  className = 'flex flex-col',
  linkClassName = 'block py-1.5 text-ink-muted no-underline hover:text-ink',
}: {
  column: FooterColumn
  className?: string
  linkClassName?: string
}) {
  return (
    <ul className={cn('m-0 list-none p-0', className)}>
      {column.links.map((link) => (
        <li key={link.key}>
          <MenuLink destination={link} className={linkClassName} />
        </li>
      ))}
    </ul>
  )
}
