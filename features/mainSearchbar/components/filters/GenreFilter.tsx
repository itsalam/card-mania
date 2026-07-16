import { useCardGenres } from '@/client/price-charting'
import { ChipRowContainer, ToggleBadge } from '@/components/ui/badge'
import React from 'react'
import { useFilters } from './providers'

/**
 * ITS-91 genre-first chip row (top-level filter). Single-select: tapping the
 * active chip clears it. Values are canonical genres from list_card_genres()
 * (already normalized, so one chip matches every raw vendor spelling).
 */
export function GenreFilter() {
  const { data: genres = [] } = useCardGenres()
  const { genre, setGenre } = useFilters()

  if (!genres.length) return null

  return (
    <ChipRowContainer>
      {genres.map(({ genre: g }) => (
        <ToggleBadge
          variant="square"
          key={g}
          label={g}
          checked={genre === g}
          onCheckedChange={() => setGenre(genre === g ? null : g)}
        />
      ))}
    </ChipRowContainer>
  )
}
