import type { ReactNode } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../lib/shadcn/table'
import { isRecord } from '../utils/rows'

type Props = {
  rows: Record<string, unknown>[]
  renderActions?: (row: Record<string, unknown>) => ReactNode
  emptyMessage?: string
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

/** Generic table that renders whatever columns the RPC returned. */
export function DataTable({ rows, renderActions, emptyMessage = 'No rows returned.' }: Props) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{emptyMessage}</p>
  }

  const columns: string[] = []
  for (const row of rows.slice(0, 50)) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key)
    }
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <TableHead key={col} className="whitespace-nowrap font-medium">
                {col}
              </TableHead>
            ))}
            {renderActions ? <TableHead className="w-px" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {columns.map((col) => (
                <TableCell key={col} className="max-w-72 truncate whitespace-nowrap">
                  {formatCell(row[col])}
                </TableCell>
              ))}
              {renderActions ? <TableCell className="text-right">{renderActions(row)}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export function isRowList(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord)
}
