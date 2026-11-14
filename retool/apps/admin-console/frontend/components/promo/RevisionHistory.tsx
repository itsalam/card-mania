import { useState } from 'react'
import { Button } from '../../lib/shadcn/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../lib/shadcn/alert-dialog'
import { History, Loader2 } from 'lucide-react'
import { formatDateTime } from '../../utils/promo'
import type { Revision } from '../../utils/promo'

type Props = {
  revisions: Revision[]
  current: number | undefined
  dirty: boolean
  onRestore: (revisionId: number) => Promise<void>
}

export function RevisionHistory({ revisions, current, dirty, onRestore }: Props) {
  const [pending, setPending] = useState<Revision | null>(null)
  const [busy, setBusy] = useState(false)

  if (revisions.length === 0) {
    return <p className="text-sm text-muted-foreground">Saved versions appear here.</p>
  }

  return (
    <>
      <ul className="divide-y divide-border rounded-md border border-border">
        {revisions.map((r) => (
          <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <History className="w-4 h-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div>
                Version {r.revision}
                {r.revision === current ? <span className="ml-2 text-xs text-muted-foreground">(current)</span> : null}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {formatDateTime(r.created_at)}
                {r.created_by_email ? ` · ${r.created_by_email}` : ''}
              </div>
            </div>
            {r.revision !== current ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setPending(r)}>
                Restore
              </Button>
            ) : null}
          </li>
        ))}
      </ul>

      <AlertDialog open={pending !== null} onOpenChange={(open) => (!open && !busy ? setPending(null) : undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore version {pending?.revision}?</AlertDialogTitle>
            <AlertDialogDescription>
              Its content is saved as a new version; nothing is lost. The publish status doesn't change, so if this
              promo is live, the restored content goes live within a few minutes.
              {dirty ? ' Your unsaved changes will be discarded.' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault()
                if (!pending) return
                setBusy(true)
                void onRestore(pending.id).finally(() => {
                  setBusy(false)
                  setPending(null)
                })
              }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Restore
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
