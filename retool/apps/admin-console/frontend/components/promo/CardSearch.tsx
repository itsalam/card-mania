import { useEffect, useState } from 'react'
import { useSearchCards } from '../../hooks/backend/admin'
import { useAuth } from '../../context/AuthContext'
import type { FnResult } from '../../context/AuthContext'
import { Input } from '../../lib/shadcn/input'
import { Button } from '../../lib/shadcn/button'
import { Loader2, Pin } from 'lucide-react'
import { useDebounced } from '../../utils/useDebounced'
import { CardThumb } from './CardThumb'
import type { CardRef } from '../../utils/promo'

type Props = {
  /** Limit results to this set (the promo's first set), or search everything. */
  setName: string | null
  pinned: string[]
  onPin: (card: CardRef) => void
}

/** Find a specific card by name to pin it to the front of the promo. */
export function CardSearch({ setName, pinned, onPin }: Props) {
  const { callAdmin } = useAuth()
  const { trigger } = useSearchCards()
  const [query, setQuery] = useState('')
  const [onlySet, setOnlySet] = useState(true)
  const [results, setResults] = useState<CardRef[]>([])
  const [loading, setLoading] = useState(false)
  const debounced = useDebounced(query.trim(), 300)

  useEffect(() => {
    if (debounced.length < 2) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    void callAdmin((token) =>
      trigger({ accessToken: token, query: debounced, setName: onlySet ? setName : null }),
    ).then((res) => {
      if (cancelled) return
      setLoading(false)
      const r = res as FnResult | undefined
      setResults(r?.ok && Array.isArray(r.data) ? (r.data as CardRef[]) : [])
    })
    return () => {
      cancelled = true
    }
  }, [debounced, onlySet, setName, callAdmin, trigger])

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Find a card to pin…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {setName ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={onlySet} onChange={(e) => setOnlySet(e.target.checked)} />
            Only in {setName}
          </label>
        ) : null}
        {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : null}
      </div>
      {results.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {results.map((c) => (
            <li key={c.ref_id} className="flex items-center gap-3 px-3 py-2">
              <CardThumb card={c} className="w-8" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{c.name}</div>
                <div className="truncate text-xs text-muted-foreground">{c.set_name}</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pinned.includes(c.ref_id)}
                onClick={() => onPin(c)}
              >
                <Pin className="w-3.5 h-3.5" />
                {pinned.includes(c.ref_id) ? 'Pinned' : 'Pin'}
              </Button>
            </li>
          ))}
        </ul>
      ) : debounced.length >= 2 && !loading ? (
        <p className="text-sm text-muted-foreground">No cards found.</p>
      ) : null}
    </div>
  )
}
