import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/')({
  ssr: true,
  component: HomePage,
})

function HomePage() {
  return (
    <main className="mx-auto w-full max-w-350 px-4 pt-8 pb-16 sm:px-6 lg:px-8">
      <h1 className="font-medium text-2xl text-foreground">Home</h1>
    </main>
  )
}
