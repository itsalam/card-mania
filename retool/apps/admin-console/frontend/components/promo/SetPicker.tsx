import { useEffect, useRef, useState } from 'react'
import { useSearchCardSets } from '../../hooks/backend/admin'
import { useAuth } from '../../context/AuthContext'
import type { FnResult } from '../../context/AuthContext'
import { Input } from '../../lib/shadcn/input'
import { Loader2, X } from 'lucide-react'
import { useDebounced } from '../../utils/useDebounced'

type SetRow = { set_name: string; genre: string | null; card_count: number; release_year: number | null }

type Props = {
  value: string[]
  onChange: (sets: string[]) => void
  id?: string
}

/** Multi-select for card sets, autocompleting from distinct cards.set_name. */
export function SetPicker({ value, onChange, id }: Props) {
  const { callAdmin } = useAuth()
  const { trigger } = useSearchCardSets()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<SetRow[]>([])
  const [loading, setLoading] = useState(false)
  const debounced = useDebounced(query, 250)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    void callAdmin((token) => trigger({ accessToken: token, query: debounced })).then((res) => {
      if (cancelled) return
      setLoading(false)
      const r = res as FnResult | undefined
      setResults(r?.ok && Array.isArray(r.data) ? (r.data as SetRow[]) : [])
    })
    return () => {
      cancelled = true
    }
  }, [debounced, open, callAdmin, trigger])

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const add = (name: string) => {
    if (!value.includes(name)) onChange([...value, name])
    setQuery('')
  }

  return (
    <div ref={boxRef} className="relative space-y-2">
      {value.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-sm"
            >
              {name}
              <button
                type="button"
                aria-label={`Remove ${name}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange(value.filter((v) => v !== name))}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <Input
        id={id}
        placeholder="Search sets, e.g. 2027 Topps"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'Enter') {
            e.preventDefault()
            if (results[0]) add(results[0].set_name)
          }
        }}
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {loading && results.length === 0 ? (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No sets match. New products may not be in the catalog yet. Type the exact set name and press Enter
              {query.trim() ? (
                <button type="button" className="ml-1 underline" onClick={() => add(query.trim())}>
                  to add “{query.trim()}”
                </button>
              ) : null}
              .
            </div>
          ) : (
            results.map((r) => (
              <button
                key={r.set_name}
                type="button"
                disabled={value.includes(r.set_name)}
                onClick={() => add(r.set_name)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-accent disabled:opacity-50"
              >
                <span className="truncate">{r.set_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {[r.release_year, r.genre, `${r.card_count} cards`].filter(Boolean).join(' · ')}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
