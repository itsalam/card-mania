import { useCallback, useEffect } from 'react'
import { useListAuditLog } from '../hooks/backend/admin'
import { useAuth } from '../context/AuthContext'
import { DataTable, isRowList } from '../components/DataTable'
import { extractRows } from '../utils/rows'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../lib/shadcn/card'
import { Button } from '../lib/shadcn/button'
import { Alert, AlertDescription } from '../lib/shadcn/alert'
import { Loader2, RefreshCw } from 'lucide-react'

export default function AuditLog() {
  const { accessToken } = useAuth()
  const { trigger, data, loading, error: hookError } = useListAuditLog()

  const refreshList = useCallback(() => {
    if (!accessToken) return
    trigger({ accessToken })
  }, [accessToken, trigger])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  const rows = data && data.ok && isRowList(data.data) ? data.data : extractRows(data?.data)
  const apiMessage = data && !data.ok ? data.message : null

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Audit log</CardTitle>
          <CardDescription>Latest 100 entries from list_audit_log.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={refreshList} disabled={loading || !accessToken}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {hookError ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{hookError}</AlertDescription>
          </Alert>
        ) : null}
        {apiMessage ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{apiMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DataTable rows={rows} emptyMessage={loading ? 'Loading audit log…' : 'No audit entries returned.'} />
      </CardContent>
    </Card>
  )
}
