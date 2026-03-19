import { useCartStore } from '@/lib/store/useCartStore'
import { useRouter } from 'expo-router'

export const useCartItems = () => useCartStore((s) => s.items)
export const useCartCount = () =>
  useCartStore((s) => s.items.reduce((n, i) => n + i.cart.quantity, 0))
export const useCartTotal = () =>
  useCartStore((s) => s.items.reduce((n, { cart }) => n + cart.price * cart.quantity, 0))

export const useOpenCart = () => {
  const router = useRouter()
  return () => router.push('/cart')
}

export const useCloseCart = () => {
  const router = useRouter()
  return () => router.back()
}

export const useAddToCart = () => useCartStore((s) => s.addItem)
export const useRemoveFromCart = () => useCartStore((s) => s.removeItem)
export const useUpdateCartQuantity = () => useCartStore((s) => s.updateQuantity)
export const useClearCart = () => useCartStore((s) => s.clear)
