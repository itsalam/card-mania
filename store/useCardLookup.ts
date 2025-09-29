import { create } from 'zustand'
import { fetchCardData, fetchCardImage } from '../lib/services'

type CardState = {
  loading: boolean
  data: any | null
  imageResults: any[] | null
  error: string | null
  lookupCard: (name: string) => Promise<void>
}

export const useCardLookup = create<CardState>((set) => ({
  loading: false,
  data: null,
  imageResults: null,
  error: null,
  lookupCard: async (name) => {
    set({ loading: true, error: null })
    try {
      const [data, image] = await Promise.all([fetchCardData(name), fetchCardImage(name)])
      set({ data, imageResults: image.images_results || [], loading: false })
    } catch (err: any) {
      set({ error: err.message, loading: false })
    }
  },
}))
