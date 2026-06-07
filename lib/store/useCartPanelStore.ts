import { create } from 'zustand'

type CartPanelStore = {
  open: boolean
  setOpen: (v: boolean) => void
}

export const useCartPanelStore = create<CartPanelStore>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
