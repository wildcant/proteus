import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/')({ component: HomePage })

function HomePage() {
  return (
    <main className="page-wrap px-4 pb-8 pt-14">
      <h1 className="display-title text-4xl font-bold tracking-tight text-[var(--sea-ink)]">Home</h1>
    </main>
  )
}
