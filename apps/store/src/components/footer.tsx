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

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-20 border-t border-(--border) px-4 pb-14 pt-10">
      <div className="mx-auto w-full max-w-[1400px] sm:px-2 lg:px-4">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-(--foreground)">{column.title}</h3>
              <ul className="m-0 list-none space-y-2 p-0">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-sm text-(--foreground-muted) no-underline hover:text-(--foreground)"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-(--border) pt-6 text-center">
          <p className="m-0 text-sm text-(--foreground-muted)">&copy; {year} Proteus. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
