import { createCardDetailsStore } from '@/features/tcg-card-views/DetailCardView/provider'

describe('createCardDetailsStore', () => {
  it('defaults card to null, footerPages to [], and currentPage to 0 when none are given', () => {
    const store = createCardDetailsStore({})

    expect(store.getState()).toMatchObject({
      card: null,
      footerPages: [],
      currentPage: 0,
      footerFullView: false,
      pendingRollback: null,
      heroImageInPosition: false,
      heroImageReady: false,
    })
  })

  it('seeds card/footerPages/currentPage/footerFullView from the given options', () => {
    const card = { id: 'card-1' } as any
    const footerPages = [
      { title: 'Save Card To', page: () => null },
      { title: 'Create Collection', page: () => null },
    ]

    const store = createCardDetailsStore({
      card,
      footerPages,
      currentPage: 1,
      footerFullView: true,
    })

    expect(store.getState()).toMatchObject({
      card,
      footerPages,
      currentPage: 1,
      footerFullView: true,
    })
  })

  describe('setPage', () => {
    it('updates currentPage when the index is within footerPages bounds', () => {
      const footerPages = [
        { title: 'A', page: () => null },
        { title: 'B', page: () => null },
      ]
      const store = createCardDetailsStore({ footerPages })

      store.getState().setPage(1)

      expect(store.getState().currentPage).toBe(1)
    })

    it('is a no-op for a negative index', () => {
      const footerPages = [{ title: 'A', page: () => null }]
      const store = createCardDetailsStore({ footerPages, currentPage: 0 })

      store.getState().setPage(-1)

      expect(store.getState().currentPage).toBe(0)
    })

    it('is a no-op for an index at or past footerPages.length', () => {
      const footerPages = [{ title: 'A', page: () => null }]
      const store = createCardDetailsStore({ footerPages, currentPage: 0 })

      store.getState().setPage(1)

      expect(store.getState().currentPage).toBe(0)
    })
  })

  it('setCard replaces the card', () => {
    const store = createCardDetailsStore({})
    const card = { id: 'card-2' } as any

    store.getState().setCard(card)

    expect(store.getState().card).toBe(card)
  })

  it('setFooterPages replaces footerPages', () => {
    const store = createCardDetailsStore({})
    const pages = [{ title: 'New', page: () => null }]

    store.getState().setFooterPages(pages)

    expect(store.getState().footerPages).toBe(pages)
  })

  it('setFooterFullView toggles footerFullView', () => {
    const store = createCardDetailsStore({})

    store.getState().setFooterFullView(true)
    expect(store.getState().footerFullView).toBe(true)

    store.getState().setFooterFullView(false)
    expect(store.getState().footerFullView).toBe(false)
  })

  it('setPendingRollback sets and clears the pending rollback', () => {
    const store = createCardDetailsStore({})
    const rollback = { count: 2, execute: jest.fn().mockResolvedValue(undefined) }

    store.getState().setPendingRollback(rollback)
    expect(store.getState().pendingRollback).toBe(rollback)

    store.getState().setPendingRollback(null)
    expect(store.getState().pendingRollback).toBeNull()
  })

  // heroImageReady/heroImageInPosition are the two entrance-timing signals footer.tsx and
  // DetailCardView/index.tsx's CardDetailContainer now share through this store — see their own
  // doc comments in the store's type for why they're deliberately two separate flags (footer
  // entrance timed to the image STARTING to move, not to it finishing).
  it('setHeroImageReady flips heroImageReady independently of heroImageInPosition', () => {
    const store = createCardDetailsStore({})

    store.getState().setHeroImageReady(true)

    expect(store.getState().heroImageReady).toBe(true)
    expect(store.getState().heroImageInPosition).toBe(false)
  })

  it('setHeroImageInPosition flips heroImageInPosition independently of heroImageReady', () => {
    const store = createCardDetailsStore({})

    store.getState().setHeroImageInPosition(true)

    expect(store.getState().heroImageInPosition).toBe(true)
    expect(store.getState().heroImageReady).toBe(false)
  })
})
