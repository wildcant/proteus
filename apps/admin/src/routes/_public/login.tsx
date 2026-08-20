import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { LoginForm } from '#/features/auth/components/login-form'

export const Route = createFileRoute('/_public/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh w-dvw items-center justify-center">
      <div className="m-4 flex w-full max-w-70 flex-col items-center">
        <div className="mb-4 flex flex-col items-center">
          <h1 className="text-2xl">Welcome to Proteus</h1>
          <p className="text-ui-fg-subtle text-center text-sm">Sign in to access the account area</p>
        </div>
        <div className="flex w-full flex-col gap-y-3">
          <LoginForm onSuccess={() => navigate({ to: '/' })} />
        </div>
      </div>
    </div>
  )
}
