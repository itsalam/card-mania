import {
  collectionPageArgs,
  collectionSort,
  isCollectionItemSort,
  moveItem,
  nextCollectionPageOffset,
} from '@/client/collections/order'

describe('collection paging (ITS-200)', () => {
  it('stops when a page comes back short', () => {
    expect(nextCollectionPageOffset([], [[]], 20)).toBeNull()
    expect(nextCollectionPageOffset([1], [[1]], 20)).toBeNull()
  })

  it('continues from everything loaded so far', () => {
    expect(nextCollectionPageOffset([1, 2], [[1, 2]], 2)).toBe(2)
    expect(
      nextCollectionPageOffset(
        [3, 4],
        [
          [1, 2],
          [3, 4],
        ],
        2
      )
    ).toBe(4)
  })

  it('always sends an offset, and the sort only when given', () => {
    expect(collectionPageArgs(null)).toEqual({ p_page_offset: 0 })
    expect(collectionPageArgs(40, 'price_desc')).toEqual({
      p_page_offset: 40,
      p_sort: 'price_desc',
    })
  })
})

describe('collection sort (ITS-200)', () => {
  it('reads a saved sort, falling back to custom', () => {
    expect(collectionSort({ item_sort: 'popular' })).toBe('popular')
    expect(collectionSort({ item_sort: 'bogus' })).toBe('custom')
    expect(collectionSort(null)).toBe('custom')
  })

  it('recognises only known sorts', () => {
    expect(isCollectionItemSort('newest')).toBe(true)
    expect(isCollectionItemSort('name')).toBe(false)
  })
})

describe('moveItem (ITS-200)', () => {
  it('moves down and up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('returns the same array when nothing moves', () => {
    const items = ['a', 'b']
    expect(moveItem(items, 1, 1)).toBe(items)
    expect(moveItem(items, 0, 5)).toBe(items)
    expect(moveItem(items, -1, 0)).toBe(items)
  })
})
