import { toast } from '@proteus/ui'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import type { AuthenticateResponse } from '#/api/generated/model'
import { LoginForm } from '#/features/auth/components/login-form'
import { RegisterForm } from '#/features/auth/components/register-form'
import { getToken } from '#/lib/auth-token'

export const Route = createFileRoute('/_main/login')({
  beforeLoad: () => {
    if (getToken()) throw redirect({ to: '/account' })
  },
  component: LoginPage,
})

type AuthView = 'sign-in' | 'register' | 'verify-pending'

function LoginPage() {
  const [currentView, setCurrentView] = useState<AuthView>('sign-in')
  const navigate = useNavigate()

  const handleSuccess = (data: AuthenticateResponse) => {
    if (data.verificationRequired) {
      setCurrentView('verify-pending')
      return
    }
    navigate({ to: '/account' })
  }

  return (
    <main className="demo-center px-4">
      <div className="demo-panel max-w-sm w-full flex flex-col items-center">
        {currentView === 'sign-in' && (
          <>
            <h1 className="demo-section-title uppercase mb-2">Welcome back</h1>
            <p className="mb-6 text-center text-sm text-[var(--sea-ink-soft)]">
              Sign in to access an enhanced shopping experience.
            </p>
            <LoginForm onSuccess={handleSuccess} onError={(error) => toast.add({ type: 'error', title: error })} />
            <Link to="/forgot-password" className="mt-4 text-xs text-[var(--sea-ink-soft)] underline">
              Forgot your password?
            </Link>
            <span className="mt-4 text-center text-xs text-[var(--sea-ink-soft)]">
              Not a member?{' '}
              <button type="button" onClick={() => setCurrentView('register')} className="underline">
                Join us
              </button>
              .
            </span>
          </>
        )}
        {currentView === 'register' && (
          <>
            <h1 className="demo-section-title uppercase mb-2">Become a member</h1>
            <p className="mb-6 text-center text-sm text-[var(--sea-ink-soft)]">
              Create your profile and get access to an enhanced shopping experience.
            </p>
            <RegisterForm onSuccess={handleSuccess} onError={(error) => toast.add({ type: 'error', title: error })} />
            <span className="mt-6 text-center text-xs text-[var(--sea-ink-soft)]">
              Already a member?{' '}
              <button type="button" onClick={() => setCurrentView('sign-in')} className="underline">
                Sign in
              </button>
              .
            </span>
          </>
        )}
        {currentView === 'verify-pending' && (
          <>
            <h1 className="demo-section-title uppercase mb-2">Check your email</h1>
            <p className="text-center text-sm text-[var(--sea-ink-soft)]">
              We sent a verification link to your email. Please click it to verify your account, then come back and log
              in.
            </p>
            <button type="button" onClick={() => setCurrentView('sign-in')} className="demo-button mt-6">
              Back to sign in
            </button>
          </>
        )}
      </div>
    </main>
  )
}
