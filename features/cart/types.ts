import { CollectionItem, CollectionItemQueryRow } from '@/client/collections/types'

export type CartItem = {
  data: CollectionItem & Partial<Pick<CollectionItemQueryRow, 'name' | 'set_name'>>
  cart: {
    price: number
    originalPrice: number
    quantity: number
    maxQuantity: number
  }
}
