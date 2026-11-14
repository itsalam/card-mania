/** @jsxRuntime automatic */
/* eslint-disable react-perf/jsx-no-new-object-as-prop */

import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { AuthProvider, allowedPages, useAuth } from './context/AuthContext'
import SignIn from './pages/SignIn'
import NotAuthorized from './pages/NotAuthorized'
import Members from './pages/Members'
import AuditLog from './pages/AuditLog'
import ComingSoon from './pages/ComingSoon'
import Promos from './pages/Promos'
import PromoEditor from './pages/PromoEditor'
import { Badge } from './lib/shadcn/badge'
import { Button } from './lib/shadcn/button'
import { Spinner } from './lib/shadcn/spinner'
import { LogOut } from 'lucide-react'
import { cn } from './lib/shadcn/utils'

const PAGE_LABELS = { promos: 'Promo boxes', members: 'Members', 'audit-log': 'Audit log' } as const

function Header() {
  const { identity, signOut } = useAuth()
  const pages = allowedPages(identity?.role)
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
        <span className="text-base font-semibold text-foreground">Card Mania Admin</span>
        <nav className="flex items-center gap-1">
          {pages.map((page) => (
            <NavLink
              key={page}
              to={`/${page}`}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
                )
              }
            >
              {PAGE_LABELS[page]}
            </NavLink>
          ))}
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
  const { status, identity } = useAuth()
  // Hide pages the role can't use. The database still enforces every permission.
  const pages = allowedPages(identity?.role)

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
          {pages.includes('promos') ? <Route path="/promos" element={<Promos />} /> : null}
          {pages.includes('promos') ? <Route path="/promos/new" element={<PromoEditor />} /> : null}
          {pages.includes('promos') ? <Route path="/promos/:id" element={<PromoEditor />} /> : null}
          {pages.includes('members') ? <Route path="/members" element={<Members />} /> : null}
          {pages.includes('audit-log') ? <Route path="/audit-log" element={<AuditLog />} /> : null}
          {pages.length === 0 ? <Route path="/coming-soon" element={<ComingSoon />} /> : null}
          <Route path="*" element={<Navigate to={pages.length ? `/${pages[0]}` : '/coming-soon'} replace />} />
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
