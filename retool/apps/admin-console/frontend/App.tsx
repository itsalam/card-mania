/** @jsxRuntime automatic */
/* eslint-disable react-perf/jsx-no-new-object-as-prop */

import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import SignIn from './pages/SignIn'
import NotAuthorized from './pages/NotAuthorized'
import Members from './pages/Members'
import AuditLog from './pages/AuditLog'
import { Badge } from './lib/shadcn/badge'
import { Button } from './lib/shadcn/button'
import { Spinner } from './lib/shadcn/spinner'
import { LogOut } from 'lucide-react'
import { cn } from './lib/shadcn/utils'

function Header() {
  const { identity, signOut } = useAuth()
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
        <span className="text-base font-semibold text-foreground">Card Mania Admin</span>
        <nav className="flex items-center gap-1">
          <NavLink
            to="/members"
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            Members
          </NavLink>
          <NavLink
            to="/audit-log"
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            Audit log
          </NavLink>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {identity ? (
            <>
              <span className="text-sm text-muted-foreground">{identity.email}</span>
              <Badge variant="secondary" className="capitalize">
                {identity.role}
              </Badge>
            </>
          ) : null}
          <Button variant="ghost" size="sm" onClick={signOut} aria-label="Sign out">
            <LogOut className="w-4 h-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}

function Shell() {
  const { status } = useAuth()

  if (status === 'signed-out' || status === 'signing-in' || status === 'checking') {
    if (status === 'checking') {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Spinner className="w-6 h-6" />
        </div>
      )
    }
    return <SignIn />
  }

  if (status === 'unauthorized') {
    return <NotAuthorized />
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-6">
        <Routes>
          <Route path="/members" element={<Members />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="*" element={<Navigate to="/members" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  )
}
/* eslint-enable react-perf/jsx-no-new-object-as-prop */
