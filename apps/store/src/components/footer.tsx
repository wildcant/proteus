import {
  AmericanexpressIcon,
  ApplepayIcon,
  FacebookIcon,
  type Icon,
  InstagramIcon,
  MastercardIcon,
  PaypalIcon,
  PinterestIcon,
  TiktokIcon,
  VisaIcon,
  XIcon,
  YoutubeIcon,
} from '@proteus/icons'
import { Link } from '@tanstack/react-router'

const columns = [
  {
    title: 'Shop',
    links: [
      { label: 'Home', to: '/' as const },
      { label: 'Products', to: '/products' as const },
      { label: 'Cart', to: '/cart' as const },
    ],
  },
  {
    title: 'Help',
    links: [
      { label: 'FAQ', to: '/' as const },
      { label: 'Contact', to: '/' as const },
    ],
  },
  {
    title: 'Company',
    links: [{ label: 'About', to: '/' as const }],
  },
]

const paymentMarks = [
  { label: 'Visa', mark: VisaIcon },
  { label: 'Mastercard', mark: MastercardIcon },
  { label: 'American Express', mark: AmericanexpressIcon },
  { label: 'PayPal', mark: PaypalIcon },
  { label: 'Apple Pay', mark: ApplepayIcon },
]

// Config-driven so the row disappears entirely until there are real accounts to link to.
const socialLinks: { label: string; href: string; mark: Icon }[] = [
  { label: 'Instagram', href: 'https://instagram.com', mark: InstagramIcon },
  { label: 'Facebook', href: 'https://facebook.com', mark: FacebookIcon },
  { label: 'X', href: 'https://x.com', mark: XIcon },
  { label: 'TikTok', href: 'https://tiktok.com', mark: TiktokIcon },
  { label: 'YouTube', href: 'https://youtube.com', mark: YoutubeIcon },
  { label: 'Pinterest', href: 'https://pinterest.com', mark: PinterestIcon },
]

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-border border-t px-4 pt-10 pb-14">
      <div className="mx-auto w-full max-w-350 sm:px-2 lg:px-4">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-3 font-bold text-foreground text-xs uppercase tracking-widest">{column.title}</h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link to={link.to} className="text-(--foreground-muted) text-sm no-underline hover:text-foreground">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <ul className="m-0 flex list-none items-center gap-3 p-0">
            {paymentMarks.map(({ label, mark: Mark }) => (
              <li key={label}>
                <Mark size={28} title={label} className="text-ink-subtle" />
              </li>
            ))}
          </ul>
          {socialLinks.length > 0 && (
            <ul className="m-0 flex list-none items-center gap-4 p-0">
              {socialLinks.map(({ label, href, mark: Mark }) => (
                <li key={label}>
                  <a href={href} className="text-ink-muted hover:text-ink" aria-label={label}>
                    <Mark size={20} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="mt-10 border-border border-t pt-6 text-center">
          <p className="m-0 text-(--foreground-muted) text-sm">&copy; {year} Proteus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
