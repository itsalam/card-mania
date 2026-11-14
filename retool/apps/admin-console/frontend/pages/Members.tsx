import { useCallback, useEffect, useState } from 'react'
import { useListMembers, useRemoveMember, useSetMemberRole } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import { DataTable, isRowList } from '../components/DataTable'
import { extractRows, pickUserId } from '../utils/rows'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Input } from '../lib/shadcn/input'
import { Label } from '../lib/shadcn/label'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../lib/shadcn/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../lib/shadcn/select'
import { Loader2, RefreshCw, Trash2, UserPlus } from 'lucide-react'

const ROLES = ['owner', 'editor', 'ops'] as const
type Role = (typeof ROLES)[number]

type FnResult = { ok: boolean; data?: unknown; message?: string }

export default function Members() {
  const { accessToken } = useAuth()
  const { trigger: triggerList, data, loading, error: listError } = useListMembers()
  const { trigger: triggerSetRole } = useSetMemberRole()
  const { trigger: triggerRemove } = useRemoveMember()

  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('editor')
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionNotice, setActionNotice] = useState<string | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<Record<string, unknown> | null>(null)
  const [busyRemovalId, setBusyRemovalId] = useState<string | null>(null)
  const [busyRole, setBusyRole] = useState(false)

  const refreshList = useCallback(() => {
    if (!accessToken) return
    triggerList({ accessToken })
  }, [accessToken, triggerList])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const rows = data && data.ok && isRowList(data.data) ? data.data : extractRows(data?.data)
  const listMessage = data && !data.ok ? data.message : null

  const handleSetRole = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!accessToken || !newEmail) return
    setBusyRole(true)
    setActionError(null)
    setActionNotice(null)
    const res = (await triggerSetRole({
      accessToken,
      p_email: newEmail,
      p_role: newRole,
    }).result) as FnResult | undefined
    setBusyRole(false)
    if (!res?.ok) {
      setActionError(res?.message ?? 'set_member_role failed.')
      return
    }
    setActionNotice(`Role set to ${newRole} for ${newEmail}.`)
    setNewEmail('')
    refreshList()
  }

  const handleConfirmRemove = async () => {
    if (!accessToken || !pendingRemoval) return
    const userId = pickUserId(pendingRemoval)
    if (!userId) return
    setBusyRemovalId(userId)
    setActionError(null)
    setActionNotice(null)
    const res = (await triggerRemove({ accessToken, p_user_id: userId }).result) as
      | FnResult
      | undefined
    setBusyRemovalId(null)
    setPendingRemoval(null)
    if (!res?.ok) {
      setActionError(res?.message ?? 'remove_member failed.')
      return
    }
    setActionNotice(`Removed member ${userId}.`)
    refreshList()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Set member role</CardTitle>
          <CardDescription>
            Calls set_member_role with {'{p_email, p_role}'}. Roles: owner, editor, ops.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetRole} className="flex flex-wrap items-end gap-3">
            <div className="space-y-2 min-w-64">
              <Label htmlFor="member-email">Email</Label>
              <Input
                id="member-email"
                type="email"
                placeholder="member@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 w-40">
              <Label>Role</Label>
              <Select value={newRole} onValueChange={(value) => setNewRole(value as Role)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={busyRole || !newEmail}>
              {busyRole ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
              Set role
            </Button>
          </form>
          {actionError ? (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
          {actionNotice ? (
            <Alert className="mt-4">
              <AlertDescription>{actionNotice}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>Loaded from list_members.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refreshList} disabled={loading || !accessToken}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {listError ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{listError}</AlertDescription>
            </Alert>
          ) : null}
          {listMessage ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{listMessage}</AlertDescription>
            </Alert>
          ) : null}
          <DataTable
            rows={rows}
            emptyMessage={loading ? 'Loading members…' : 'No members returned.'}
            renderActions={(row) => {
              const userId = pickUserId(row)
              if (!userId) return null
              return (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setPendingRemoval(row)}
                  aria-label={`Remove member ${userId}`}
                >
                  <Trash2 className="w-4 h-4" />
                  Remove
                </Button>
              )
            }}
          />
        </CardContent>
      </Card>

      <AlertDialog
        open={pendingRemoval !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRemoval(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This calls remove_member for user{' '}
              <span className="font-mono">{pendingRemoval ? pickUserId(pendingRemoval) : ''}</span>. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmRemove()
              }}
            >
              {busyRemovalId ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
