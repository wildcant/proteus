import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/')({ component: HomePage })

function HomePage() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-medium text-(--foreground)">Home</h1>
    </main>
  )
}
