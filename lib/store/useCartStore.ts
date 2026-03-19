import type { CartItem } from '@/features/cart/types'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

type CartState = {
  items: CartItem[]
}

type CartActions = {
  addItem: (item: CartItem) => void
  removeItem: (collectionItemId: string) => void
  updateQuantity: (collectionItemId: string, quantity: number) => void
  clear: () => void
}

export const useCartStore = create<CartState & CartActions>()(
  persist(
    (set) => ({
      items: [],

      addItem: (item) =>
        set((s) => {
          const existing = s.items.find((i) => i.data.id === item.data.id)
          if (existing) {
            console.log({ existing })
            return {
              items: s.items.map((i) =>
                i.data.id === item.data.id
                  ? {
                      ...i,
                      cart: {
                        ...i.cart,
                        quantity: Math.min(
                          i.cart.quantity + item.cart.quantity,
                          i.cart.maxQuantity
                        ),
                      },
                    }
                  : i
              ),
            }
          }
          return { items: [...s.items, item] }
        }),

      removeItem: (collectionItemId) =>
        set((s) => ({
          items: s.items.filter((i) => i.data.id !== collectionItemId),
        })),

      updateQuantity: (collectionItemId, quantity) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.data.id === collectionItemId ? { ...i, cart: { ...i.cart, quantity } } : i
          ),
        })),

      clear: () => set({ items: [] }),
    }),
    {
      name: 'cart-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ items: s.items }),
    }
  )
)
