import { collectionPageCursorArgs, nextCollectionPageCursor } from '@/client/collections/order'

describe('collection page cursor (ITS-200)', () => {
  it('stops when the page is short', () => {
    expect(nextCollectionPageCursor([], 20)).toBeNull()
    expect(nextCollectionPageCursor([{ sort_position: 0, sort_created_at: 'x' }], 20)).toBeNull()
  })

  it('carries the last row’s position and date', () => {
    const page = [
      { sort_position: 0, sort_created_at: '2026-11-25T10:00:00Z' },
      { sort_position: 3, sort_created_at: '2026-11-24T10:00:00Z' },
    ]
    expect(nextCollectionPageCursor(page, 2)).toEqual({
      position: 3,
      createdAt: '2026-11-24T10:00:00Z',
    })
  })

  it('falls back to created_at for rows without a sort key', () => {
    expect(nextCollectionPageCursor([{ created_at: '2026-11-24T10:00:00Z' }], 1)).toEqual({
      position: 0,
      createdAt: '2026-11-24T10:00:00Z',
    })
  })

  it('maps a cursor to RPC args', () => {
    expect(collectionPageCursorArgs(null)).toEqual({})
    expect(collectionPageCursorArgs({ position: 2, createdAt: 't' })).toEqual({
      p_page_param: 't',
      p_page_position: 2,
    })
  })
})
