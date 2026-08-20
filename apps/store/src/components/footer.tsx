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
        <div className="mt-10 border-border border-t pt-6 text-center">
          <p className="m-0 text-(--foreground-muted) text-sm">&copy; {year} Proteus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
