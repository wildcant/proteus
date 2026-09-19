import { Button } from '@proteus/ui'
import { Link } from '@tanstack/react-router'
import { ShieldXIcon } from 'lucide-react'

export function ForbiddenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <ShieldXIcon className="size-16 text-muted-foreground" />
        <h1 className="font-semibold text-2xl">Access Denied</h1>
        <p className="text-muted-foreground">You don't have permission to access this page.</p>
        <Button render={<Link to="/" />}>Go to Home</Button>
      </div>
    </div>
  )
}
